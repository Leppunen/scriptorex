module.exports.initialize = () => {
    return new Promise((resolve, reject) => {
        sc.Temp.cmdFiles.clear();
        sc.Temp.cmdAliases.clear();
        sc.Utils.recurseDir(`${require.main.path}/commands`, /\.js$/).forEach((f) => {
            try {
                delete require.cache[`${f}`];
                const cmd = require(`${f}`);
                sc.Temp.cmdFiles.set(cmd.help.name, cmd);
                if (cmd.help.aliases) {
                    cmd.help.aliases.forEach((alias) => {
                        sc.Temp.cmdAliases.set(alias, cmd.help.name);
                    });
                }
            } catch (e) {
                e.filename = f;
                sc.Logger.error(`Failed to load command file ${f}, Error: ${e}`);
                return reject(e);
            }
        });
        sc.Logger.info(`Loaded ${sc.Temp.cmdFiles.size} commands!`);
        return resolve(true);
    });
};

module.exports.sync = async function commandSync() {
    const crypto = require('crypto');
    const cmdFiles = Array.from(sc.Temp.cmdFiles.values()).filter((cmd) => !cmd.help.archived);
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
                sc.Logger.debug(`Local version of command ${cmd.help.name} differs from the database version. Updating database version.`);
                await sc.Utils.db.query('UPDATE Commands SET Code = ?, Checksum = ? WHERE Name = ?', [String(cmd.run), checkSum, cmd.help.name]);
            }
        }
    }
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
    const commandData = this.get(cmdString);

    if (!commandData) {
        return {state: false, cmd: cmdString, data: 'cmd-not-found'};
    }

    //    if (sc.Modules.cooldown(cmdMeta, { name: cmdMeta.Name }, { 'Mode': 'check' })) {
    //        return { state: false, cmd: cmdString, data: 'cooldown' };
    //    }

    if (cmdMeta.type === 'privmsg' || cmdMeta.platform === 'Discord') {
        sc.Modules.cooldown(cmdMeta, {name: commandData.Name, UserCooldown: commandData.User_Cooldown, Cooldown: commandData.Cooldown}, {'Level': commandData.Cooldown_Mode || 'UserCommand'});
    } else if (cmdMeta.type === 'whisper') {
        sc.Modules.cooldown(cmdMeta, {name: commandData.Name, UserCooldown: commandData.User_Cooldown, Cooldown: commandData.Cooldown}, {'Level': 'Whisper'});
    }

    const filtered = sc.Modules.filter.check({userid: userMeta.ID || null, channel: cmdMeta.channelMeta, command: commandData, platform: cmdMeta.platform});
    if (filtered) {
        return {state: false, cmd: cmdString, data: filtered};
    }

    try {
        let cmdResp = await eval(commandData.Code)(cmdMeta);

        if (commandData.Ping) {
            if (cmdMeta.platform === 'Twitch') {
                cmdResp = `@${cmdMeta.user.name}, ${cmdResp}`;
            } else if (cmdMeta.platform === 'Discord') {
                cmdResp = `${cmdMeta.user.mentionString}, ${cmdResp}`;
            }
        }

        await sc.Utils.misc.dblog('Command', cmdMeta.type === 'whisper' ? 'Whisper' : cmdMeta.channel, cmdMeta.user.name, cmdMeta.user.id, cmdMeta.command, cmdMeta.message.args.join(' ') || null, cmdResp ? cmdResp.substring(0, 300) : null);

        // Check the message against custom banphrases
        if (!commandData.Skip_Custom_Banphrases) {
            cmdResp = await sc.Modules.banphrase.custom(cmdMeta.channel, cmdResp);
        }

        // Check the message against pajbot banphrase API
        if (cmdMeta.platform === 'Twitch', cmdMeta.channelMeta.Protect && !commandData.Skip_API_Banphrases) {
            cmdResp = await sc.Modules.banphrase.pajbot(cmdMeta, cmdResp);
        }

        return {state: true, cmd: cmdString, data: cmdResp};
    } catch (e) {
        throw new Error(e);
    }
};
