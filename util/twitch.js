module.exports.bot = async (username) => {
    try {
        const {data} = await util.api.bot('/twitch/bot/'+username);
        return data;
    } catch (err) {
        if (err.response && err.response.status === 404) return false;
        throw new Error(err);
    }
};

module.exports.resolver = async (target) => {
    try {
        const {data} = await util.api.bot(`/twitch/resolve/${target}`);
        return data;
    } catch (err) {
        if (err.response && err.response.status === 404) return false;
        throw new Error(err);
    }
};

module.exports.resolveid = async (target) => {
    try {
        const {data} = await util.api.bot(`/twitch/resolve/${target}?id=1`);
        return data;
    } catch (err) {
        if (err.response && err.response.status === 404) return false;
        throw new Error(err);
    }
};


module.exports.stream = async (username) => {
    try {
        const {data} = await util.api.bot('/twitch/stream/'+username);
        return data;
    } catch (err) {
        if (err.response && err.response.status === 404) return false;
        throw new Error(err);
    }
};

module.exports.inchat = async (channel, username) => {
    try {
        const {status, data} = await util.api.tmi(`/group/user/${channel}/chatters`);
        if (status === 200) {
            const all = Object.keys(data['chatters'])
                .flatMap((e) => data['chatters'][e]);
            if (all.includes(username.toLowerCase())) {
                return true;
            } else {
                return false;
            }
        }
    } catch (err) {
        throw new Error(err);
    }
};

module.exports.chatters = async (channel) => {
    try {
        const {status, data} = await util.api.tmi(`/group/user/${channel}/chatters`);
        if (status === 200) {
            const all = Object.keys(data['chatters'])
                .flatMap((e) => data['chatters'][e]);
            return all;
        }
    } catch (err) {
        throw new Error(err);
    }
};
