const mariadb = require('mariadb');
const config = require('../config');
const pool = mariadb.createPool(config.db);

pool.getConnection((err) => {
    if (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            logger.error('Database connection was closed.');
            process.exit(1);
        }
        if (err.code === 'ER_CON_COUNT_ERROR') {
            logger.error('Database has too many connections.');
            process.exit(1);
        }
        if (err.code === 'ECONNREFUSED') {
            logger.error('Database connection was refused.');
            process.exit(1);
        }
        logger.error('Unhandled MariaDB Error: ' + err.code);
    }
});

module.exports = pool;
