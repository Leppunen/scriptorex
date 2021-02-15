const mariadb = require('mariadb');
const options = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    rowsAsArray: false,
};
const pool = mariadb.createPool(options);

pool.getConnection((err) => {
    if (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            sc.Logger.error('Database connection was closed.');
            process.exit(1);
        }
        if (err.code === 'ER_CON_COUNT_ERROR') {
            sc.Logger.error('Database has too many connections.');
            process.exit(1);
        }
        if (err.code === 'ECONNREFUSED') {
            sc.Logger.error('Database connection was refused.');
            process.exit(1);
        }
        sc.Logger.error('Unhandled MariaDB Error: ' + err.code);
    }
});

module.exports = pool;
