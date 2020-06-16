module.exports.get = async (data = {}) => {
    if (!data.Platform || !data.id && data.Platform !== 'Cytube') {
        throw new Error('No Platform or ID provided.');
    }

    switch (data.Platform) {
    case 'Twitch': {
        const user = (await sc.Utils.db.query('SELECT * FROM User WHERE Twitch_ID = ?', [data.id]))[0];

        if (!user) {
            if (data.createIfNotExists) {
                await sc.Modules.user.create(data);
                return (await sc.Modules.user.get(data));
            } else {
                return false;
            }
        } else {
            if (data.name && user.Username !== data.name) {
                await sc.Utils.db.query('INSERT INTO Name_History (UserID, Previous_Name, New_Name) VALUES (?, ?, ?)', [user.ID, user.Username, data.name]);
                await sc.Utils.db.query('UPDATE User SET Username = ? WHERE Twitch_ID = ?', [data.name, data.id]);
            }
            if (user.Extra) {
                user.Extra = JSON.parse(user.Extra);
            }
            return user;
        }
    }
    case 'Discord': {
        const user = (await sc.Utils.db.query('SELECT * FROM User WHERE Discord_ID = ?', [data.id]))[0];
        if (!user) {
            return false;
        } else {
            if (user.Extra) {
                user.Extra = JSON.parse(user.Extra);
            }
            return user;
        }
    }
    case 'Cytube': {
        const user = (await sc.Utils.db.query('SELECT * FROM User WHERE Cytube_Name = ?', [data.name]))[0];
        if (!user) {
            return false;
        } else {
            if (user.Extra) {
                user.Extra = JSON.parse(user.Extra);
            }
            return user;
        }
    }
    default:
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
