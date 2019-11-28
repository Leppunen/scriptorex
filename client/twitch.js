const {ChatClient, AlternateMessageModifier, SlowModeRateLimiter} = require('dank-twitch-irc');
const chalk = require('chalk');

const config = require('../config');

const client = new ChatClient({
    username: config.twitch.username,
    password: config.twitch.password,
    rateLimits: 'verifiedBot',
});

client.use(new AlternateMessageModifier(client));
client.use(new SlowModeRateLimiter(client, 20));

global.bot = client;

client.timeouts = new Set();
client.commands = new Map();
client.aliases = new Map();

client.initialize = async () => {
    await client.joinAll(bot.data.channels.filter((channel) => channel.Connect === 1).map((channel) => channel.Name));
    client.connect();
};

client.on('ready', async () => {
    logger.info(`${chalk.green('[CONNECTED]')} || Connected to Twitch.`);
    await client.say(config.twitch.username, 'Running!');
});

client.on('error', (error) => {
    logger.error(`${chalk.red('[ERROR]')} || Error occurred in DTI: ${error}`);
});

client.on('CLEARCHAT', async (msg) => {
    if (msg.isTimeout() && msg.targetUsername === config.twitch.username) {
        logger.warn(`${chalk.green('[Timeout]')} || Got timed out in ${msg.channelName} for ${msg.banDuration} seconds`);
        await util.misc.dblog('Timeout', msg.channelName, msg.targetUsername, null, `Duration: ${msg.banDuration} seconds`, null, null);
        client.timeouts.add(msg.channelName);
        setTimeout(() => {
            client.timeouts.delete(msg.channelName);
        }, msg.banDuration * 1000 + 250);
    }
    if (msg.wasChatCleared()) {
        logger.info(`${chalk.green('[CLEARCHAT]')} || Chat was cleared in ${msg.channelName}`);
    }
});

client.on('NOTICE', async ({channelName, messageID, messageText, ...others}) => {
    if (!messageID) {
        return;
    }

    switch (messageID) {
    case 'msg_rejected':
    case 'msg_rejected_mandatory': {
        logger.debug(`Received msg_rejected/mandatory from ${channelName}! -> ${messageText}`);
        break;
    }

    case 'no_permission': {
        logger.debug(`Received no_permission from ${channelName}! -> ${messageText}`);
        break;
    }

    case 'host_on':
    case 'host_target_went_offline': {
        break;
    }

    default:
        await util.misc.dblog('Notice', channelName, null, null, messageID, messageText, null);
        logger.info(`${chalk.green('[NOTICE]')} || Incoming notice: ${messageID} in channel ${channelName} -> ${messageText}`);
    }
});

module.exports = client;
