const chalk = require('chalk');
const utils = require('util');

const bot = require('./client/twitch');
const config = require('./config');
const logger = require('./util/winston');
const util = require('./util');
const modules = require('./modules');

bot.commandCounter = 0;

// Get config from API
const initData = async () => {
    try {
        ({data: bot.data} = await util.api.botnc('/bot'));
    } catch (e) {
        logger.error('Error loading config: ' + e.message);
        process.exit(0);
    }
};

// Reload config from API
bot.reload = async () => {
    try {
        ({data: bot.data} = await util.api.botnc('/bot'));
        await loadCmd();
        return 'Success';
    } catch (e) {
        logger.error(`Reload error: ${e}`);
        return Promise.reject(e);
    }
};

const loadCmd = () => {
    return new Promise((resolve, reject) => {
        bot.commands.clear();
        bot.aliases.clear();
        util.recurseDir('./commands', /\.js$/).forEach((f) => {
            try {
                delete require.cache[`${__dirname}/${f}`];
                const cmd = require(`./${f}`);
                bot.commands.set(cmd.help.name, cmd);
                if (cmd.help.aliases) {
                    cmd.help.aliases.forEach((alias) => {
                        bot.aliases.set(alias, cmd.help.name);
                    });
                }
            } catch (e) {
                e.filename = f;
                logger.error(`Failed to load command file ${f}, Error: ${e}`);
                return reject(e);
            }
        });
        logger.info(`Loaded ${bot.commands.size} commands!`);
        return resolve(true);
    });
};


// Level
const levelCheck = (userid) => {
    if (bot.data.user.admins.includes(userid)) {
        return 2;
    } else if (bot.data.user.whitelisted.includes(userid)) {
        return 1;
    } else {
        return 0;
    }
};

// Initialize Data and Connect
async function connect() {
    try {
        await initData();
        await loadCmd();
        await bot.initialize();
        await util.misc.supiactive();
    } catch (e) {
        logger.error(`Error encountered during initialization: ${e}`);
    }
}

connect();

bot.on('PRIVMSG', dtiHandler);

// DTI Command Handler
async function dtiHandler(msg) {
    const message = msg.messageText.replace(config.parms.msgregex, '');
    const channelMeta = bot.data.channels.find((chn) => chn.Name === msg.channelName);

    if (bot.timeouts.has(msg.channelName)) return;
    if (msg.senderUsername === config.twitch.username) return;
    if (msg.messageText.indexOf(config.parms.prefix) !== 0) return;
    if (!bot.data.user.admins.includes(msg.senderUserID) && channelMeta.Ignore === 1) return;

    const level = levelCheck(msg.senderUserID);
    const content = message.split(/\s+/g);
    const command = content[0];
    const commandstring = command.slice(config.parms.prefix.length);
    const args = content.slice(1);
    const cmdData = {
        'user': {
            'id': msg.senderUserID,
            'name': msg.displayName,
            'login': msg.senderUsername,
            'level': level,
            'color': msg.colorRaw,
            'badges': msg.badgesRaw,
        },
        'message': {
            'raw': msg.rawSource,
            'text': message,
            'args': args,
        },
        'command': commandstring,
        'channel': msg.channelName,
        'channelMeta': channelMeta,
        'userstate': msg.ircTags,
        'msgObj': msg,
    };

    const cmd = bot.commands.get(commandstring) || bot.commands.get(bot.aliases.get(commandstring));
    if (!cmd) return;
    if (modules.cooldown(cmdData.channel, cmdData.user, cmd.help, {'Mode': 'check'})) {
        logger.debug(`Command ${cmd.help.name} is in cooldown in channel ${cmdData.channel} for user ${cmdData.user.name}`);
        return;
    }

    try {
        // Temporary hack to get rid of old ignored command thing. Will be removed when filters are implemented.
        if (cmdData.channel === 'forsen' && ['modlookup', 'resolve', 'tags', 'gdq', 'xkcd'].includes(commandstring)) {
            return;
        }

        // Check if the command is limited to a specific set of users.
        if (cmd.help.users && !cmd.help.users.includes(cmdData.user.id) && level !== 2) {
            modules.cooldown(cmdData.channel, cmdData.user, cmd.help);
            return await dtiSend(cmdData, '✋ :) You are not allowed to run this command');
        }

        // Check if the command is limited to a specific set of channels.
        if (cmd.help.channels && cmd.help.channels.length !== 0 && !cmd.help.channels.includes(cmdData.channel) && level !== 2) {
            modules.cooldown(cmdData.channel, cmdData.user, cmd.help);
            return await dtiSend(cmdData, '✋ :) This command is not allowed in this channel');
        }

        // Check that the user has permissions to run the command.
        if (cmd.help.level && !(level >= cmd.help.level)) {
            await dtiSend(cmdData, '✋ :) You do not have the required level to use this command');
            modules.cooldown(cmdData.channel, cmdData.user, cmd.help);
            return logger.info(`${chalk.red('[COMMAND]')} || User ${chalk.magenta(cmdData.user.name)} tried to run command ${cmd.help.name} Without access in ${cmdData.channel}.`);
        }

        // Execute command and apply cooldowns
        if (level !== 2) {
            modules.cooldown(cmdData.channel, cmdData.user, cmd.help, {'Level': cmd.help.Mode || 'UserCommand'});
        }
        const cmdReply = await cmd.run(cmdData);
        bot.commandCounter++;

        if (!cmd.help.nolog) await util.misc.dblog('Command', cmdData.channel, cmdData.user.name, cmdData.user.id, cmdData.command, cmdData.message.args.join(' ') || null, cmdReply || null);

        if (cmd.help.noreply) return;

        if (!cmdReply) {
            return await dtiSend(cmdData, 'Command returned no data. must be something Pepega');
        }

        // Send the command reply
        return await dtiSend(cmdData, cmdReply, cmd.help);
    } catch (e) {
        if (e.response) {
            await util.misc.dberror('AxiosError', e.message, utils.inspect(e.response));
        }
        logger.json(e);
        await util.misc.dberror(e.name, e.message, e.stack);
        if (e instanceof SyntaxError) {
            logger.warn(`${chalk.red('[SyntaxError]')} || ${e.name} -> ${e.message} ||| ${e.stack}`);
            return await dtiSend(cmdData, 'This command has a Syntax Error.');
        }
        if (e instanceof TypeError) {
            logger.warn(`${chalk.red('[TypeError]')} || ${e.name} -> ${e.message} ||| ${e.stack}`);
            return await dtiSend(cmdData, 'This command has a Type Error.');
        }
        await dtiSend(cmdData, 'Error occurred while executing the command. FeelsBadMan');
        return logger.error(`Error executing command: (${e.name}) -> ${e.message} ||| ${e.stack}`);
    }
}

// Send the message, also check for banphrases before sending.
const dtiSend = async (meta, msg, cmd) => {
    msg = msg.replace(/\n|\r/g, '');
    try {
        // Check the message against custom banphrases
        if (cmd && !cmd.skipcustombanphrases) {
            msg = await modules.banphrase.custom(meta.channel, msg);
        }

        // Check the message against pajbot banphrase API
        if (meta.channelMeta.Protect && (cmd && !cmd.nocheck)) {
            msg = await modules.banphrase.pajbot(meta, msg);
        }

        // Trim the message to the twitch message limit or lower if configured
        let lengthLimit = meta.channelMeta.Length || config.parms.msgLenLimit;
        lengthLimit -= 2;
        let message = msg.substring(0, lengthLimit);
        if (message.length < msg.length) {
            message = msg.substring(0, lengthLimit - 1) + '…';
        }

        return await bot.say(meta.channel, message);
    } catch (e) {
        await bot.say(meta.channel, 'Error while processing the reply message monkaS');
        logger.error(`Error while processing reply message: ${e}`);
        await util.misc.dberror('SendError', e.message, e.stack);
    }
};

// Exception Handlers
process
    .on('unhandledRejection', async (reason, promise) => {
        await util.misc.dberror('PromiseRejection', utils.inspect(promise), utils.inspect(reason));
        return logger.error(`${chalk.red('[UnhandledRejection]')} || ${utils.inspect(promise)} -> ${reason}`);
    })
    .on('uncaughtException', async (err) => {
        await util.misc.dberror('UncaughtException', err.message, err.stack);
        await util.misc.push('Uncaught Exception detected!', `${err.stack}`);
        logger.error(`${chalk.red('[UncaughtException]')} || ${err.message}`);
        return process.exit(0);
    });

// Misc stuff

// Update Supinic bot status every 10 minutes

setInterval(async () => {
    try {
        await util.misc.supiactive();
    } catch (e) {
        logger.warn(`Error while refreshing bot active status: ${e}`);
    }
}, 600000);
