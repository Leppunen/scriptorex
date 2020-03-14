const Twitch = require('dank-twitch-irc');
const chalk = require('chalk');
const utils = require('util');

const client = new Twitch.ChatClient({
    username: sc.Config.twitch.username,
    password: sc.Config.twitch.password,
    rateLimits: 'verifiedBot',
});

client.use(new Twitch.AlternateMessageModifier(client));
client.use(new Twitch.SlowModeRateLimiter(client, 20));

client.timeouts = new Set();

client.initialize = async () => {
    const channels = sc.Channel.getJoinable('Twitch');
    await client.joinAll(channels);
    client.connect();
};

client.on('ready', async () => {
    sc.Logger.info(`${chalk.green('[CONNECTED]')} || Connected to Twitch.`);
    await client.say(sc.Config.twitch.username, 'Running!');
});

client.on('error', (error) => {
    if (error instanceof Twitch.JoinError) {
        sc.Logger.warn(`${chalk.red('[JOIN]')} || Error joining channel ${error.failedChannelName}: ${error}`);
    }
    if (error instanceof Twitch.SayError) {
        sc.Logger.warn(`${chalk.red('[SAY]')} || Error sending message in ${error.failedChannelName}: ${error.cause} | ${error}`);
    }
    sc.Logger.error(`${chalk.red('[ERROR]')} || Error occurred in DTI: ${error}`);
});

client.on('CLEARCHAT', async (msg) => {
    if (msg.isTimeout() && msg.targetUsername === sc.Config.twitch.username) {
        sc.Logger.warn(`${chalk.green('[Timeout]')} || Got timed out in ${msg.channelName} for ${msg.banDuration} seconds`);
        await sc.Utils.misc.dblog('Timeout', msg.channelName, msg.targetUsername, null, `Duration: ${msg.banDuration} seconds`, null, null);
        client.timeouts.add(msg.channelName);
        setTimeout(() => {
            client.timeouts.delete(msg.channelName);
        }, msg.banDuration * 1000 + 250);
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

    default:
        await sc.Utils.misc.dblog('Notice', channelName, null, null, messageID, messageText, null);
        sc.Logger.info(`${chalk.green('[NOTICE]')} || Incoming notice: ${messageID} in channel ${channelName} -> ${messageText}`);
    }
});

client.on('PRIVMSG', (msg) => handleMsg(msg));

client.on('WHISPER', (msg) => handleMsg(msg));

const handleMsg = async (msg) => {
    const type = (msg instanceof Twitch.WhisperMessage) ? 'whisper' : 'privmsg';
    const channelMeta = sc.Data.channels.find((chn) => chn.Name === msg.channelName) || {};

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
    if (client.timeouts.has(msg.channelName)) {
        return;
    }

    // If the stream is live and bot should be silent during live, do nothing.
    if (type === 'privmsg' && channelMeta.Extra.silenceIfLive && sc.Utils.cache.redis.get(`streamLive-${channelMeta.Name}`)) {
        return;
    }

    // Ignore messages not starting with prefix
    if (msg.messageText.indexOf(sc.Config.parms.prefix) !== 0) {
        return;
    }

    // Check if channel is ignored
    if (type === 'privmsg' && channelMeta.Ignore === 1) {
        return;
    }

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
        'platform': 'Twitch',
        'command': commandstring,
        'channel': msg.channelName,
        'channelid': msg.channelID,
        'channelMeta': channelMeta,
        'userstate': msg.ircTags,
        'msgObj': msg,
    };

    const cmdMeta = sc.Command.get(commandstring);

    // No command found. Do nothing.
    if (!cmdMeta) {
        return;
    }

    // Check if cooldown is active.
    if (sc.Modules.cooldown(cmdData, {name: cmdMeta.Name}, {'Mode': 'check'})) {
        return;
    }

    if (type === 'whisper' && !cmdMeta.Whisperable) {
        sc.Modules.cooldown(cmdData, {name: cmdMeta.name, UserCooldown: cmdMeta.User_Cooldown, Cooldown: cmdMeta.Cooldown}, {'Level': 'Whisper'});
        return await pm(cmdData, cmd.help, 'This command is not whisperable');
    }

    try {
        const userMeta = await sc.Modules.user.get({Platform: cmdData.platform, id: cmdData.user.id, name: cmdData.user.login, createIfNotExists: true});
        const cmdRun = await sc.Command.execute(commandstring, cmdData, userMeta);
        if (cmdRun.state === false) {
            if (cmdRun.data === 'cooldown') {
                return;
            }
            return await send(cmdData, `Command Error: ${cmdRun.data}`);
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
        await sc.Utils.misc.dberror(e.name, e.message, e.stack);
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
};

const send = async (meta, msg) => {
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
            return await client.say(meta.channel, 'That message violates the channel automod settings.');
        }
        await client.say(meta.channel, 'Error while processing the reply message monkaS');
        sc.Logger.error(`Error while processing reply message: ${e}`);
        await sc.Utils.misc.dberror('SendError', e.message, e.stack);
    }
};

const pm = async (meta, msg) => {
    await client.whisper(meta.user.login, msg);
};

module.exports = client;
