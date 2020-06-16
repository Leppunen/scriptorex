const chalk = require('chalk');
const utils = require('util');

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
    } catch (e) {
        sc.Logger.error(`Error encountered during initialization: ${e}`);
    }
}

start();

// Exception Handlers
process
    .on('unhandledRejection', async (reason, promise) => {
        await sc.Utils.misc.logError('PromiseRejection', utils.inspect(promise), utils.inspect(reason));
        return sc.Logger.error(`${chalk.red('[UnhandledRejection]')} || ${utils.inspect(promise)} -> ${reason}`);
    })
    .on('uncaughtException', async (err) => {
        await sc.Utils.misc.logError('UncaughtException', err.message, err.stack);
        await sc.Utils.misc.push('Uncaught Exception detected!', `${err.stack}`);
        sc.Logger.error(`${chalk.red('[UncaughtException]')} || ${err.message}`);
        return process.exit(0);
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
