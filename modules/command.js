module.exports.initialize = () => {
    return new Promise((resolve) => {
        sc.Temp.cmdFiles.clear();
        sc.Temp.cmdAliases.clear();

        const commandFiles = sc.Utils.recurseDir(`${require.main.path}/commands`, /\.js$/);

        for (const cmdFile of commandFiles) {
            try {
                delete require.cache[`${cmdFile}`];
                const cmd = require(`${cmdFile}`);
                if (cmd.help.archived) return;
                sc.Temp.cmdFiles.set(cmd.help.name, cmd);
                if (cmd.help.aliases) {
                    for (const alias of cmd.help.aliases) {
                        sc.Temp.cmdAliases.set(alias, cmd.help.name);
                    }
                }
            } catch (e) {
                e.filename = f;
                sc.Logger.error(`Failed to load command file ${f}, Error: ${e}`);
                throw new Error(e);
            }
        }

        sc.Logger.info(`Loaded ${sc.Temp.cmdFiles.size} commands!`);
        resolve();
    });
};

module.exports.sync = async () => {
    const crypto = require('crypto');
    const cmdFiles = Array.from(sc.Temp.cmdFiles.values()).filter((cmd) => !cmd.help.archived);
    const changedCmd = [];
    for (const cmd of cmdFiles) {
        const dbCmd = (await sc.Utils.db.query('SELECT ID, Name, Checksum, Code FROM Commands WHERE Name = ?', [cmd.help.name]))[0];
        if (!dbCmd) {
            sc.Logger.warn(`No database match found for command ${cmd.help.name}. Creating new command`);
            if (cmd.help.channel || cmd.help.users || cmd.help.level) {
                sc.Logger.debug(`Command ${cmd.help.name} has limits configured. Setting command to Whitelisted.`);
                if (cmd.help.aliases) {
                    await sc.Utils.db.query('INSERT INTO Commands (Name, Aliases, Description, Code, Whitelisted) VALUES (?, ?, ?, ?, ?)', [cmd.help.name, JSON.stringify(cmd.help.aliases), cmd.help.description, String(cmd.run), 1]);
                } else {
                    await sc.Utils.db.query('INSERT INTO Commands (Name, Description, Code, Whitelisted) VALUES (?, ?, ?, ?)', [cmd.help.name, cmd.help.description, String(cmd.run), 1]);
                }
            } else {
                if (cmd.help.aliases) {
                    await sc.Utils.db.query('INSERT INTO Commands (Name, Aliases, Description, Code) VALUES (?, ?, ?, ?)', [cmd.help.name, JSON.stringify(cmd.help.aliases), cmd.help.description, String(cmd.run)]);
                } else {
                    await sc.Utils.db.query('INSERT INTO Commands (Name, Description, Code) VALUES (?, ?, ?)', [cmd.help.name, cmd.help.description, String(cmd.run)]);
                }
            }
            const checkSum = crypto.createHash('sha256').update(String(cmd.run), 'utf8').digest('hex');
            await sc.Utils.db.query('UPDATE Commands SET Checksum = ? WHERE Name = ?', [checkSum, cmd.help.name]);
        } else {
            const checkSum = crypto.createHash('sha256').update(String(cmd.run), 'utf8').digest('hex');
            if (checkSum !== dbCmd.Checksum) {
                changedCmd.push(cmd.help.name);
                sc.Logger.info(`Local version of command ${cmd.help.name} differs from the database version. Updating database version.`);
                await sc.Utils.db.query('UPDATE Commands SET Code = ?, Checksum = ? WHERE Name = ?', [String(cmd.run), checkSum, cmd.help.name]);
            }
        }
    }
    return changedCmd;
};

module.exports.get = (cmdString) => {
    const command = sc.Data.cmd.find((cmd) => cmd.Name === cmdString || eval(cmd.Aliases).includes(cmdString));
    if (!command) {
        return null;
    }

    if (command.Aliases) {
        try {
            command.Aliases = eval(command.Aliases);
        } catch (e) {
            sc.Logger.error(`Command ${command.Name} has an invalid alias definition.`);
            command.Aliases = [];
        }
    }

    return command;
};

module.exports.execute = async (cmdString, cmdMeta, userMeta) => {
    const commandData = sc.Command.get(cmdString);
    const channelData = sc.Channel.get(cmdMeta.platform === 'Twitch' ? cmdMeta.channel : cmdMeta.channelid);

    if (!commandData) {
        return {state: false, cmd: cmdString, data: 'cmd-not-found'};
    }

    if (cmdMeta.type === 'privmsg' || cmdMeta.platform === 'Discord') {
        await sc.Modules.cooldown(cmdMeta, {'Level': commandData.Cooldown_Mode || 'UserCommand'});
    } else if (cmdMeta.type === 'whisper') {
        await sc.Modules.cooldown(cmdMeta, {'Level': 'Whisper'});
    }

    const filtered = sc.Modules.filter.check({userid: userMeta.ID || null, channel: cmdMeta.channelMeta, command: commandData, platform: cmdMeta.platform});
    if (filtered) {
        return {state: false, cmd: cmdString, data: filtered};
    }

    let cmdResp = await eval(commandData.Code)(cmdMeta);

    if (commandData.Ping) {
        if (cmdMeta.platform === 'Twitch') {
            cmdResp = `@${cmdMeta.user.name}, ${cmdResp}`;
        } else if (cmdMeta.platform === 'Discord') {
            if (!cmdResp.embedData) {
                cmdResp = `${cmdMeta.user.mentionString}, ${cmdResp}`;
            }
        }
    }

    if (commandData.Log) {
        await sc.Utils.misc.log(
            'Command',
            cmdMeta.platform,
            channelData.ID ? channelData.ID : null,
            userMeta ? userMeta.ID : null,
            `${commandData.Name} ${cmdMeta.message.args.join(' ')}`.trim(),
            JSON.stringify({
                User: cmdMeta.user.name,
                Login: cmdMeta.user.login,
                Channel: cmdMeta?.channel,
                Description: channelData.Description,
            },
            null, 2),
            cmdResp || null,
        );
    }

    // Check if the message has links and remove them if links are not allowed in the channel.
    if (sc.Config.parms.linkRegex.test(cmdResp) && channelData.Extra.Links === false) {
        cmdResp = cmdResp.replace(sc.Config.parms.linkRegex, ' [LINK] ');
    }

    // Check the message against custom banphrases
    if (!commandData.Skip_Custom_Banphrases) {
        cmdResp = await sc.Modules.banphrase.custom(cmdMeta.channel, cmdResp);
    }

    if (cmdMeta.platform === 'Twitch' && cmdMeta.type === 'privmsg') {
        // Check the message against pajbot banphrase API
        if (cmdMeta.channelMeta.Protect && !commandData.Skip_API_Banphrases) {
            cmdResp = await sc.Modules.banphrase.pajbot(cmdMeta, cmdResp);
        }

        // Check the message against pajbot2 for message height
        if (channelData.Extra.checkHeight) {
            cmdResp = await sc.Modules.banphrase.checkHeight(channelData, cmdResp);
        }

        cmdResp = await sc.Modules.banphrase.checkMassping(cmdMeta.channel, cmdResp);
    }

    return {state: true, cmd: cmdString, data: cmdResp};
};
