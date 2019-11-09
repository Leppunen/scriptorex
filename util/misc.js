const humanize = require('humanize-duration');
const shortHumanize = humanize.humanizer({
    language: 'shortEn',
    languages: {
        shortEn: {
            y: () => 'y',
            mo: () => 'mo',
            w: () => 'w',
            d: () => 'd',
            h: () => 'h',
            m: () => 'm',
            s: () => 's',
            ms: () => 'ms',
        },
    },
});

module.exports.uptime = function() {
    const ms = process.uptime() * 1000;
    return shortHumanize(ms, {
        units: ['d', 'h', 'm', 's', 'ms'],
        largest: 4,
        round: true,
        conjunction: ' and ',
    });
};

module.exports.humanizeTimeStamp = (stamp, options) => {
    const ms = new Date().getTime() - Date.parse(stamp);
    options = options || {
        units: ['y', 'd', 'h', 'm', 's'],
        largest: 3,
        round: true,
        conjunction: ' and ',
        spacer: '',
    };
    return shortHumanize(ms, options);
};

module.exports.paste = async (pastedata) => {
    try {
        const {status, data} = await util.api.paste({data: pastedata.toString()});
        if (status === 200) {
            return `https://paste.ivr.fi/${data.key}`;
        }
    } catch (e) {
        throw new Error(e);
    }
};

module.exports.push = async (title, message) => {
    try {
        const {data} = await util.api.push({data: {message: message, title: title}});
        if (data.status === 1) {
            return 'Success';
        }
    } catch (err) {
        throw new Error(err.response.data.errors);
    }
};

module.exports.supiactive = async () => {
    try {
        const {data: {statusCode, data}} = await util.api.supinic.put('/bot/active');
        if (statusCode === 200 && data.success) {
            return 'Success';
        }
    } catch (err) {
        throw new Error(err);
    }
};

module.exports.getVideoInfo = async (url) => {
    try {
        let tags = '';
        let tagData = '';
        ({data: {data, data: {type, extra, extra: {tags: tagData}}}} = await util.api.supinic(`/track/fetch/?url=${url}`));
        if (type === 'bilibili') {
            tagData = tagData.map((item) => item.name);
        }
        if (type === 'bilibili' || type === 'nicovideo') {
            ({data: {translation: tags}} = await util.api.bot(`/translate/?text=${encodeURI(tagData)}`));
        }
        if (tagData && type === 'youtube') {
            tagData = tagData.join(' - ');
        }
        return {
            info: data,
            tags: tagData || 'No tags',
            engtags: tags || null,
        };
    } catch (e) {
        throw new Error(e);
    }
};

module.exports.dblog = async (type, channel, username, userid, data, extra, response) => {
    const insert = [type, channel, username, userid, data, extra, response];
    await util.db.query('INSERT INTO logs (type, channel, username, userid, data, extra, response) VALUES (?, ?, ?, ?, ?, ?, ?)', insert);
};

module.exports.dberror = async (type, data, extra) => {
    const insert = [type, data, extra];
    await util.db.query('INSERT INTO error (type, data, extra) VALUES (?, ?, ?)', insert);
};
