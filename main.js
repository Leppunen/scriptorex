const chalk = require('chalk');

const {Rcon} = require('rcon-client');

global.sc = {};
sc.Temp = {};

// Load Modules
sc.Config = (require('./config'));
sc.Utils = (require('./util'));
sc.Logger = (require('./util/winston'));
sc.Modules = (require('./modules'));
sc.Command = (require('./modules/command'));
sc.Channel = (require('./modules/channel'));

// Load Clients
sc.Twitch = (require('./client/twitch'));
sc.TwitchPubSub = (require('./client/twitch-pubsub'));
sc.Discord = (require('./client/discord'));
sc.Cytube = (require('./client/cytube'));

sc.Rcon = new Rcon({host: sc.Config.rcon.host, port: 25575, password: sc.Config.rcon.password});

sc.Temp.cmdCount = 0;
sc.Temp.cmdFiles = new Map();
sc.Temp.cmdAliases = new Map();

// Initialize Data and Connect Clients
async function start() {
    try {
        await sc.Modules.config.loadAll();
        await sc.Modules.token.check();
        await sc.Twitch.initialize();
        sc.TwitchPubSub.connect();
        await sc.Discord.connect();
        sc.Cytube.initialize();
        // await sc.Rcon.connect();
    } catch (e) {
        sc.Logger.error(`Error encountered during initialization: ${e}`);
    }
}

start();

// Exception Handlers
process
    .on('unhandledRejection', (err) => {
        if (err.name === 'SayError') {
            return;
        }
        if (err.name === 'EvalError') {
            return;
        }
        return sc.Logger.error(`${chalk.red('[UnhandledRejection]')} || [${err.name}] ${err} - ${err.stack}`);
    })
    .on('uncaughtException', async (err) => {
        await sc.Utils.misc.logError('UncaughtException', err.message, err.stack);
        await sc.Utils.misc.push('Uncaught Exception detected!', `${err.stack}`);
        sc.Logger.error(`${chalk.red('[UncaughtException]')} || ${err.message}`);
        process.abort();
    });

// Misc

// Update Supinic bot status every 10 minutes
setInterval(async () => {
    try {
        await sc.Utils.misc.supiactive();
    } catch (e) {
        sc.Logger.warn(`Error while refreshing bot active status: ${e}`);
    }
}, 600000);

// Update Emote data
setInterval(async () => {
    try {
        sc.Temp.emoteData = [];
        for (const setID of sc.Temp.emoteSets) {
            if (setID === '0' || (setID.length === 9 && setID.startsWith('4') || setID.startsWith('5'))) continue;
            const {status, channellogin, channelid, tier, emotes} = await sc.Utils.got.bot(`twitch/emoteset/${setID}`, {throwHttpErrors: false}).json();
            if (status === 404) continue;
            sc.Temp.emoteData.push({setID, channellogin, channelid, tier, emotes});
        }
    } catch (e) {
        sc.Logger.warn(`Error while checking for emoteset data for: ${e}`);
    }
}, 600000);
