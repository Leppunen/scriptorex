module.exports.resolver = async (target) => {
    try {
        return await sc.Utils.got.bot(`twitch/resolve/${target}`).json();
    } catch (err) {
        if (err?.response?.statusCode === 404) return false;
        throw new Error(err);
    }
};

module.exports.resolveid = async (target) => {
    try {
        return await sc.Utils.got.bot(`twitch/resolve/${target}?id=1`).json();
    } catch (err) {
        if (err?.response?.statusCode === 404) return false;
        throw new Error(err);
    }
};

module.exports.bot = async (username) => {
    try {
        return await sc.Utils.got.bot(`twitch/bot/${username}`).json();
    } catch (err) {
        if (err?.response?.statusCode === 404) return false;
        throw new Error(err);
    }
};

module.exports.stream = async (username) => {
    try {
        return await sc.Utils.got.bot(`twitch/stream/${username}`).json();
    } catch (err) {
        if (err?.response?.statusCode === 404) return false;
        throw new Error(err);
    }
};


module.exports.chatters = async (channel) => {
    const body = await sc.Utils.cache.get(`chatters-${channel}`);
    if (body) {
        return Object.keys(body['chatters']).flatMap((e) => body['chatters'][e]);
    } else {
        const body = await sc.Utils.got.tmi(`group/user/${channel.toLowerCase()}/chatters`).json();
        await sc.Utils.cache.set(`chatters-${channel}`, body);
        return Object.keys(body['chatters']).flatMap((e) => body['chatters'][e]);
    }
};
