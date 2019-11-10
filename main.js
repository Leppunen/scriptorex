const fs = require('fs');
const chalk = require('chalk');
const utils = require('util');

const bot = require('./util/dti');
const config = require('./config');
const logger = require('./util/winston');
const util = require('./util');

global.util = util;
global.logger = logger;

const userCooldown = new Set();
const chanCooldown = new Set();
bot.commandCounter = 0;

// Get config from API
const initData = async () => {
    try {
        ({data: {channel: bot.chn, user: bot.usr, channels: bot.channels, users: bot.users, banphrase: bot.banphrase, cmd: bot.cmd}} = await util.api.botnc('/bot'));
    } catch (e) {
        logger.error('Error loading config: ' + e.message);
        process.exit(0);
    }
};

// Reload config from API
bot.reload = async () => {
    try {
        ({data: {channel: bot.chn, user: bot.usr, channels: bot.channels, users: bot.users, banphrase: bot.banphrase, cmd: bot.cmd}} = await util.api.botnc('/bot'));
        await loadCommands();
        return 'Success';
    } catch (e) {
        logger.error(`Reload error: ${e}`);
        return Promise.reject(e);
    }
};

// Import all commands
const loadCommands = () => {
    return new Promise((resolve, reject) => {
        bot.commands.clear();
        bot.aliases.clear();
        fs.readdir('./commands/', (err, files) => {
            const cmdFiles = files.filter((f) => f.split('.').pop() === 'js');
            cmdFiles.forEach((f, i) => {
                try {
                    delete require.cache[`${__dirname}/commands/${f}`];
                    const props = require(`./commands/${f}`);

                    bot.commands.set(props.help.name, props);
                    if (props.help.aliases) {
                        props.help.aliases.forEach((alias) => {
                            bot.aliases.set(alias, props.help.name);
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
    });
};

// Level
const levelCheck = (userid) => {
    if (bot.usr.admins.includes(userid)) {
        return 2;
    } else if (bot.usr.whitelisted.includes(userid)) {
        return 1;
    } else {
        return 0;
    }
};

// Initialize Data and Connect
async function connect() {
    try {
        await initData();
        await loadCommands();
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
    if (bot.timeouts.has(msg.channelName)) return;
    if (msg.senderUsername === config.twitch.username) return;
    if (msg.messageText.indexOf(config.parms.prefix) !== 0) return;
    if (bot.usr.ignored.includes(msg.senderUserID)) return;
    if (!bot.usr.admins.includes(msg.senderUserID) && bot.chn.cfg[msg.channelName].ignored) return;
    if (chanCooldown.has(msg.channelName)) return;
    if (userCooldown.has(msg.senderUserID)) return;

    const level = levelCheck(msg.senderUserID);
    const message = msg.messageText.replace(config.parms.msgregex, '');

    if (message.startsWith(config.parms.prefix)) {
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
                'mod': msg.isMod,
                'badges': msg.badgesRaw,
            },
            'message': {
                'raw': msg.rawSource,
                'text': message,
                'args': args,
            },
            'command': commandstring,
            'channel': msg.channelName,
            'userstate': msg.ircTags,
            'msgObj': msg,
        };

        let cmd = bot.commands.get(commandstring);
        if (!cmd) cmd = bot.commands.get(bot.aliases.get(commandstring));

        if (cmd) {
            try {
                // Check if the command is ignored in the called channel.
                if (bot.chn.cfg[cmdData.channel].ignoredcmd.includes(commandstring) && level !== 2) {
                    await dtiSend(cmdData, '✋ :) This command is not allowed in this channel');
                    return logger.info(`${chalk.red('[COMMAND]')} || User ${chalk.magenta(cmdData.user.name)} ran a blocked command ${cmd.help.name} in channel ${cmdData.channel}`);
                }

                // Check if the command is limited to a specific set of users.
                if (cmd.help.users && !cmd.help.users.includes(cmdData.user.id) && level !== 2) {
                    return await dtiSend(cmdData, '✋ :) You are not allowed to run this command');
                }

                // Check if the command is limited to a specific set of channels.
                if (cmd.help.channels && cmd.help.channels.length !== 0 && !cmd.help.channels.includes(cmdData.channel) && level !== 2) {
                    return await dtiSend(cmdData, '✋ :) This command is not allowed in this channel');
                }

                // Check that the user has permissions to run the command.
                if (cmd.help.level && !(level >= cmd.help.level)) {
                    await dtiSend(cmdData, '✋ :) You do not have the required level to use this command');
                    return logger.info(`${chalk.red('[COMMAND]')} || User ${chalk.magenta(cmdData.user.name)} tried to run command ${cmd.help.name} Without access in ${cmdData.channel}.`);
                }

                // Execute command and apply cooldowns
                if (!level >= 2) {
                    await applyCooldowns(cmdData.channel, cmdData.user.id);
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
    }
}

// Apply cooldowns
async function applyCooldowns(channel, userid) {
    userCooldown.add(userid);

    setTimeout(() => {
        userCooldown.delete(userid);
    }, bot.chn.cfg[channel].usercd || config.parms.usercd);
}

// Send the message, also check for banphrases before sending.
const dtiSend = async (meta, msg, cmd) => {
    msg = msg.replace(/\n|\r/g, '');
    try {
        // Check the message against custom banphrases
        if (cmd && !cmd.skipcustombanphrases) {
            msg = await util.banphrase.custom(meta.channel, msg);
        }

        // Check the message against pajbot banphrase API
        if (bot.chn.cfg[meta.channel].protected && (cmd && !cmd.nocheck)) {
            msg = await util.banphrase.pajbot(meta.channel, msg, meta);
        }

        // Trim the message to the twitch message limit or lower if configured
        let lengthLimit = bot.chn.cfg[meta.channel].length || config.parms.msgLenLimit;
        lengthLimit -= 2;
        let message = msg.substring(0, lengthLimit);
        if (message.length < msg.length) {
            message = msg.substring(0, lengthLimit - 1) + '…';
        }

        return await bot.say(meta.channel, message);
    } catch (e) {
        if (e instanceof SayError && e.message.includes('You are timed out')) {
            return logger.debug('Timed out. Do not send');
        }
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
