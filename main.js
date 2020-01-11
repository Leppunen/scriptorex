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

// Load Clients
sc.Twitch = (require('./client/twitch'));
sc.Discord = (require('./client/discord'));

bot.commandCounter = 0;

// Get config from API
async function initData() {
    try {
        ({data: bot.data, data: sc.Data} = await sc.Utils.api.botnc('/bot'));
    } catch (e) {
        sc.Logger.error('Error loading config: ' + e.message);
        process.exit(0);
    }
}

// Reload config from API
bot.reload = async () => {
    try {
        await sc.Command.initialize();
        await sc.Command.sync();
        ({data: bot.data, data: sc.Data} = await sc.Utils.api.botnc('/bot'));
        return true;
    } catch (e) {
        sc.Logger.error(`Reload error: ${e}`);
        return Promise.reject(e);
    }
};

// Initialize Data and Connect Clients
async function start() {
    try {
        await initData();
        await sc.Command.initialize();
        await sc.Twitch.initialize();
        await sc.Discord.connect();
    } catch (e) {
        sc.Logger.error(`Error encountered during initialization: ${e}`);
    }
}

start();

// Exception Handlers
process
    .on('unhandledRejection', async (reason, promise) => {
        await sc.Utils.misc.dberror('PromiseRejection', utils.inspect(promise), utils.inspect(reason));
        return sc.Logger.error(`${chalk.red('[UnhandledRejection]')} || ${utils.inspect(promise)} -> ${reason}`);
    })
    .on('uncaughtException', async (err) => {
        await sc.Utils.misc.dberror('UncaughtException', err.message, err.stack);
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
