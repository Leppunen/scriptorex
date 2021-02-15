const {createLogger, format, transports, addColors} = require('winston');
const {combine, colorize, timestamp, printf} = format;
const chalk = require('chalk');
const util = require('util');

const loggerlevels = {
    colors: {
        info: 'green',
        error: 'underline bold red',
        debug: 'bold magenta',
        warn: 'yellow',
    },
};

const logFormat = printf(({level, message, timestamp}) => {
    return `${chalk.magenta(timestamp)} [${level}]: ${message}`;
});

const winston = createLogger({
    format: combine(
        format((info) => {
            info.level = info.level.toUpperCase();
            return info;
        })(),
        timestamp({
            format: 'DD.MM.YY HH:mm:ss.SSS',
        }),
        colorize(),
        logFormat,
    ),
    transports: [new transports.Console({
        stderrLevels: ['error'],
        colorize: true,
    })],
});
addColors(loggerlevels.colors);

if (process.env.loglevel) {
    winston.transports[0].level = process.env.loglevel;
    winston.info(`Setting loglevel to ${winston.transports[0].level}`);
} else {
    winston.transports[0].level = 'info';
    winston.info(`Setting loglevel to ${winston.transports[0].level}`);
}

module.exports.info = (...args) => {
    winston.info(...args);
};

module.exports.error = (...args) => {
    winston.error(...args);
};

module.exports.debug = (...args) => {
    winston.debug(...args);
};

module.exports.warn = (...args) => {
    winston.warn(...args);
};

module.exports.json = (...args) => {
    winston.debug(util.inspect(...args));
};
