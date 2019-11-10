const {ChatClient, AlternateMessageModifier, SlowModeRateLimiter} = require('dank-twitch-irc');
const chalk = require('chalk');

const config = require('../config');

const client = new ChatClient({
    username: config.twitch.username,
    password: config.twitch.password,
    rateLimits: 'verifiedBot',
});


client.use(new AlternateMessageModifier(client));
client.use(new SlowModeRateLimiter(client));

global.bot = client;

client.timeouts = new Set();
client.commands = new Map();
client.aliases = new Map();

client.initialize = async () => {
    await client.joinAll(bot.channels.filter((channel) => channel.Connect === 1).map((channel) => channel.Name));
    await client.connect();
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

client.on('NOTICE', async (msg) => {
    if (!msg.messageID.match(config.parms.ignoredMsgIds)) {
        await util.misc.dblog('Notice', msg.channelName, null, null, msg.messageID, msg.messageText, null);
    }
    logger.info(`${chalk.green('[NOTICE]')} || Incoming notice: ${msg.messageID} in channel ${msg.channelName} -> ${msg.messageText}`);
});

module.exports = client;
