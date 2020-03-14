const Redis = require('ioredis');
const redis = new Redis({db: 3});

redis.on('error', (err) => {
    sc.Logger.error(`Redis Error: ${err}`);
});

redis.on('ready', () => {
    sc.Logger.info('Redis Connected');
});

module.exports.redis = redis;

module.exports.getBase64 = async (name) => {
    const data = await redis.get(name);
    if (!data) {
        return null;
    }
    return JSON.parse(Buffer.from(data, 'base64'));
};

module.exports.setBase64 = async (name, data, expiry = 120) => {
    await redis.set(name, Buffer.from(JSON.stringify(data)).toString('base64'), 'EX', expiry);
};
