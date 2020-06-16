const Twitch = require('dank-twitch-irc');
const chalk = require('chalk');

const client = new Twitch.ChatClient({
    username: sc.Config.twitch.username,
    rateLimits: 'verifiedBot',
});

client.use(new Twitch.AlternateMessageModifier(client));
client.use(new Twitch.SlowModeRateLimiter(client, 10));

client.initialize = async () => {
    client.configuration.password = `oauth:${await sc.Utils.cache.get('oauth-token')}`;
    const channels = sc.Channel.getJoinable('Twitch');
    await client.joinAll(channels);
    client.connect();
};

client.on('ready', async () => {
    sc.Logger.info(`${chalk.green('[CONNECTED]')} || Connected to Twitch.`);
    const rebootChannel = await sc.Utils.cache.get('lastRebootChannel');
    if (rebootChannel) {
        await client.say(rebootChannel, 'Running!');
    } else {
        await client.say(sc.Config.twitch.username, 'Running!');
    }
});

client.on('error', async (error) => {
    if (error instanceof Twitch.LoginError) {
        sc.Logger.warn(`${chalk.red('[LOGIN]')} || Error logging in to Twitch: ${error}`);
        client.configuration.password = `oauth:${await sc.Utils.cache.get('oauth-token')}`;
    }
    if (error instanceof Twitch.JoinError) {
        return sc.Logger.warn(`${chalk.red('[JOIN]')} || Error joining channel ${error.failedChannelName}: ${error}`);
    }
    if (error instanceof Twitch.SayError) {
        return sc.Logger.warn(`${chalk.red('[SAY]')} || Error sending message in ${error.failedChannelName}: ${error.cause} | ${error}`);
    }
    sc.Logger.error(`${chalk.red('[ERROR]')} || Error occurred in DTI: ${error}`);
});

client.on('CLEARCHAT', async (msg) => {
    if (msg.isTimeout() && msg.targetUsername === sc.Config.twitch.username) {
        sc.Logger.warn(`${chalk.green('[Timeout]')} || Got timed out in ${msg.channelName} for ${msg.banDuration} seconds`);
        sc.Utils.cache.set(`channelTimeout-${msg.channelName}`, true, msg.banDuration + 2);
    }

    if (msg.wasChatCleared()) {
        sc.Logger.info(`${chalk.green('[CLEARCHAT]')} || Chat was cleared in ${msg.channelName}`);
    }
});

client.on('NOTICE', async ({channelName, messageID, messageText}) => {
    if (!messageID) {
        return;
    }

    switch (messageID) {
    case 'msg_rejected':
    case 'msg_rejected_mandatory': {
        sc.Logger.debug(`Received msg_rejected/mandatory from ${channelName}! -> ${messageText}`);
        break;
    }

    case 'no_permission': {
        sc.Logger.debug(`Received no_permission from ${channelName}! -> ${messageText}`);
        break;
    }

    case 'host_on':
    case 'host_target_went_offline': {
        break;
    }

    default: {
        const channelMeta = sc.Channel.get(channelName);
        await sc.Utils.misc.log('Notice', 'Twitch', channelMeta.ID, null, messageID, messageText, null);
        sc.Logger.info(`${chalk.green('[NOTICE]')} || Incoming notice: ${messageID} in channel ${channelName} -> ${messageText}`);
    }
    }
});

client.on('PRIVMSG', (msg) => handleMsg(msg));

client.on('WHISPER', (msg) => handleMsg(msg));

const handleMsg = async (msg) => {
    const type = (msg instanceof Twitch.WhisperMessage) ? 'whisper' : 'privmsg';
    const channelMeta = sc.Channel.get(msg.channelName);

    const message = msg.messageText.replace(sc.Config.parms.msgregex, '');
    const content = message.split(/\s+/g);
    const command = content[0];
    const commandstring = command.slice(sc.Config.parms.prefix.length);
    const args = content.slice(1);

    const cmdData = {
        'user': {
            'id': msg.senderUserID,
            'name': msg.displayName,
            'login': msg.senderUsername,
            'color': msg.colorRaw,
            'badges': msg.badgesRaw,
        },
        'message': {
            'raw': msg.rawSource,
            'text': message,
            'args': args,
        },
        'type': type,
        'nsfw': channelMeta?.Extra?.NSFW,
        'platform': 'Twitch',
        'command': commandstring,
        'channel': msg.channelName,
        'channelid': msg.channelID,
        'channelMeta': channelMeta,
        'userstate': msg.ircTags,
    };

    // Update bot status
    if (msg.senderUsername === sc.Config.twitch.username && channelMeta) {
        const currMode = channelMeta.Mode;
        if (msg.badges) {
            if (msg.badges.hasModerator || msg.badges.hasBroadcaster) {
                channelMeta.Mode = 'Moderator';
            } else if (msg.badges.hasVIP) {
                channelMeta.Mode = 'VIP';
            } else {
                channelMeta.Mode = 'User';
            }
            if (currMode !== channelMeta.Mode) {
                await sc.Utils.db.query('UPDATE Channel SET `Mode` = ? WHERE `Name` = ?', [channelMeta.Mode, channelMeta.Name]);
            }
        }
    }

    // Ignore messages from self.
    if (msg.senderUsername === sc.Config.twitch.username) {
        return;
    }

    // If the bot is timed out, do not process anything
    if (await sc.Utils.cache.get(`channelTimeouts-${msg.channelName}`)) {
        return;
    }

    // If the stream is live and bot should be silent during live, do nothing.
    if (type === 'privmsg' && channelMeta.Extra.silenceIfLive && await sc.Utils.cache.redis.get(`streamLive-${channelMeta.Name}`)) {
        return;
    }

    // Check if channel is ignored
    if (type === 'privmsg' && channelMeta.Ignore === 1) {
        return;
    }

    // Check if input is a keyword
    if (sc.Modules.keyword.check(cmdData)) {
        const reply = await sc.Modules.keyword.get(cmdData);
        return await send(cmdData, reply);
    }

    // Input is a command. Process it as such
    if (msg.messageText.startsWith(sc.Config.parms.prefix)) {
        const cmdMeta = sc.Command.get(commandstring);

        // No command found. Do nothing.
        if (!cmdMeta) {
            return;
        } else {
            cmdData.cmdMeta = cmdMeta;
        }

        // Check if cooldown is active.
        if (await sc.Modules.cooldown(cmdData, {'Mode': 'check'})) {
            return;
        }

        if (type === 'whisper' && !cmdMeta.Whisperable) {
            await sc.Modules.cooldown(cmdData, {'Level': 'Whisper'});
            return await pm(cmdData, cmd.help, 'This command is not whisperable');
        }

        try {
            const userMeta = await sc.Modules.user.get({Platform: cmdData.platform, id: cmdData.user.id, name: cmdData.user.login, createIfNotExists: true});
            cmdData.userMeta = userMeta;
            const cmdRun = await sc.Command.execute(commandstring, cmdData, userMeta);

            if (cmdRun.state === false) {
                return await send(cmdData, `Command ${cmdRun.cmd} failed: ${cmdRun.data}`);
            }

            sc.Temp.cmdCount++;

            if (!cmdMeta.Reply) {
                return;
            }

            if (!cmdRun.data) {
                if (type === 'whisper') {
                    return await pm(cmdData, 'Command returned no data.');
                }
                return await send(cmdData, 'Command returned no data. must be something Pepega');
            }

            if (type === 'whisper') {
                return await pm(cmdData, cmdRun.data);
            }
            return await send(cmdData, cmdRun.data);
        } catch (e) {
            await sc.Utils.misc.logError(e.name, e.message, e.stack);
            if (e instanceof SyntaxError) {
                sc.Logger.warn(`${chalk.red('[SyntaxError]')} || ${e.name} -> ${e.message} ||| ${e.stack}`);
                return await send(cmdData, 'This command has a Syntax Error.');
            }
            if (e instanceof TypeError) {
                sc.Logger.warn(`${chalk.red('[TypeError]')} || ${e.name} -> ${e.message} ||| ${e.stack}`);
                return await send(cmdData, 'This command has a Type Error.');
            }
            await send(cmdData, 'Error occurred while executing the command. FeelsBadMan');
            return sc.Logger.error(`Error executing command: (${e.name}) -> ${e.message} ||| ${e.stack}`);
        }
    }
};

const send = async (meta, msg) => {
    if (!msg || !meta) {
        return;
    }
    msg = msg.replace(/\n|\r/g, '');
    try {
        // Trim the message to the twitch message limit or lower if configured
        let lengthLimit = meta.channelMeta.Length || sc.Config.parms.msgLenLimit;
        lengthLimit -= 2;
        let message = msg.substring(0, lengthLimit);
        if (message.length < msg.length) {
            message = msg.substring(0, lengthLimit - 1) + '…';
        }
        await client.say(meta.channel, message);
    } catch (e) {
        if (e instanceof Twitch.SayError && e.message.includes('@msg-id=msg_rejected')) {
            return await send(meta, 'That message violates the channel automod settings.');
        }
        if (e instanceof Twitch.SayError && e.message.includes('@msg-id=msg_duplicate')) {
            return await send(meta, 'That message was a duplicate monkaS');
        }
        await client.say(meta.channel, 'Error while processing the reply message monkaS');
        sc.Logger.error(`Error while processing reply message: ${e}`);
        await sc.Utils.misc.logError('SendError', e.message, e.stack);
    }
};

const pm = async (meta, msg) => {
    await client.whisper(meta.user.login, msg);
};

module.exports = client;
