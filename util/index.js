global.util = this;

// Recursive directory read
exports.recurseDir = require('./recurseDir.js').find;

// Axios API instances
exports.api = require('./api.js');

// Miscellaneous utilities
exports.misc = require('./misc.js');

// MySQL
exports.db = require('./mariadb.js');

// Twitch Stuff
exports.twitch = require('./twitch.js');

// Logger
exports.logger = require('./winston.js');
