// Axios API instances
exports.api = require('./api.js');

// Miscellaneous utilities
exports.misc = require('./misc.js');

// Paste
exports.paste = require('./misc.js').paste;

// MySQL
exports.db = require('./mariadb.js');

// Twitch Stuff
exports.twitch = require('./twitch.js');

// Logger
exports.logger = require('./winston.js');

// Banphrase Checker
exports.banphrase = require('./banphrase.js');
