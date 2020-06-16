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

module.exports.uptime = () => {
    const ms = process.uptime() * 1000;
    return shortHumanize(ms, {
        units: ['w', 'd', 'h', 'm', 's'],
        largest: 4,
        round: true,
        conjunction: ' and ',
        spacer: '',
    });
};

module.exports.secondConvert = (seconds) => {
    const ms = seconds * 1000;
    return shortHumanize(ms, {
        units: ['h', 'm', 's', 'ms'],
        round: true,
        conjunction: ' and ',
        spacer: '',
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
    const {key} = await sc.Utils.got.paste({body: pastedata.toString()}).json();
    return `https://paste.ivr.fi/${key}`;
};

module.exports.push = async (title, message) => {
    const {status} = await sc.Utils.got.push({json: {message: message, title: title}}).json();
    if (status === 1) {
        return true;
    } else {
        return false;
    }
};

module.exports.supiactive = async () => {
    const {data} = await sc.Utils.got.supinic.put('bot-program/bot/active').json();
    if (data.success) {
        return 'Success';
    }
};

module.exports.getVideoInfo = async (url) => {
    let tags = '';
    let tagData = '';
    ({data, data: {type, extra, extra: {tags: tagData}}} = await sc.Utils.got.supinic(`/track/fetch/?url=${url}`)).json();
    if (type === 'bilibili') {
        tagData = tagData.map((item) => item.name);
    }
    if (type === 'bilibili' || type === 'nicovideo') {
        ({body: {translation: tags}} = await sc.Utils.got.bot(`translate/?text=${encodeURI(tagData)}`));
    }
    if (tagData && type === 'youtube') {
        tagData = tagData.join(' - ');
    }
    return {
        info: data,
        tags: tagData || 'No tags',
        engtags: tags || null,
    };
};

module.exports.randomArray = (array) => {
    return array[Math.floor(Math.random() * array.length)];
};

module.exports.dblog = async (type, channel, username, userid, data, extra, response) => {
    const insert = [type, channel, username, userid, data, extra, response];
    await sc.Utils.db.query('INSERT INTO Bot_Log (type, channel, username, userid, data, extra, response) VALUES (?, ?, ?, ?, ?, ?, ?)', insert);
};

module.exports.dberror = async (type, data, extra) => {
    const insert = [type, data, extra];
    await sc.Utils.db.query('INSERT INTO Bot_Error (type, data, extra) VALUES (?, ?, ?)', insert);
};
