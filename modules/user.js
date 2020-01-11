module.exports.get = async (data = {}) => {
    if (!data.Platform || !data.id) {
        throw new Error('No Platform or ID provided.');
    }
    if (data.Platform === 'Twitch') {
        const user = (await sc.Utils.db.query('SELECT * FROM User WHERE Twitch_ID = ?', [data.id]))[0];
        if (!user) {
            if (data.createIfNotExists) {
                await this.create(data);
                return (await this.get(data));
            } else {
                return false;
            }
        } else {
            return user;
        }
    } else if (data.Platform === 'Discord') {
        const user = (await sc.Utils.db.query('SELECT * FROM User WHERE Discord_ID = ?', [data.id]))[0];
        if (!user) {
            return false;
        } else {
            return user;
        }
    } else {
        return false;
    }
};

module.exports.create = async (data = {}) => {
    if (data.Platform !== 'Twitch' || !data.id || !data.name) {
        throw new Error('[User-Create] -> Missing parameters or incorrect platform');
    }
    try {
        const {insertId} = await sc.Utils.db.query('INSERT INTO User (Username, Twitch_ID) VALUES (?, ?)', [data.name, data.id]);
        sc.Logger.debug(`[User-Create] -> User ${data.name}/${data.id} created with ID ${insertId}`);
        return true;
    } catch (e) {
        if (e.errno === 1062) {
            return '[User-Create] -> User already exists!';
        }
        return false;
    }
};
