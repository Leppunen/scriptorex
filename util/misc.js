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

const htmlEntities = {
    'nbsp': ' ',
    'lt': '<',
    'gt': '>',
    'amp': '&',
    'quot': '"',
    'apos': '\'',
    'cent': '¢',
    'pound': '£',
    'yen': '¥',
    'euro': '€',
    'copy': '©',
    'reg': '®',
};

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
    ({data, data: {type, extra, extra: {tags: tagData}}} = await sc.Utils.got.supinic(`track/fetch/?url=${url}`)).json();
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

module.exports.fixHTML = (string) => {
    return string.replace(/&#?(?<identifier>[a-z0-9]+);/g, (...params) => {
        const {identifier} = params.pop();
        return htmlEntities[identifier] || String.fromCharCode(Number(identifier));
    });
};

module.exports.getPlatformLatency = async (platform) => {
    switch (platform) {
    case 'Twitch': {
        const {performance} = require('perf_hooks');
        const t0 = performance.now();
        await sc.Twitch.ping();
        const t1 = performance.now();
        return (t1 - t0).toFixed();
    }
    case 'Discord':
        return sc.Discord.shards.get(0).latency;
    default:
        return null;
    }
};

module.exports.log = async (type, platform, channel, username, data, extra, response) => {
    const insert = [type, platform, channel, username, data, extra, response];
    await sc.Utils.db.query('INSERT INTO BotLogs (Type, Platform, Channel, User, Data, Extra, Response) VALUES (?, ?, ?, ?, ?, ?, ?)', insert);
};

module.exports.logError = async (type, data, extra) => {
    const insert = [type, data, extra];
    await sc.Utils.db.query('INSERT INTO BotErrors (Type, Data, Extra) VALUES (?, ?, ?)', insert);
};
