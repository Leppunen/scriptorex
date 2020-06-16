const got = require('got');

// Generic pajbot Banphrases
module.exports.ban = got.extend({
    responseType: 'json',
    method: 'post',
    timeout: 1500,
});

// Generic GET requests
module.exports.generic = got.extend({
    timeout: 1500,
});

// DNSApi
module.exports.dns = got.extend({
    url: 'https://cloudflare-dns.com/dns-query',
    timeout: 800,
    responseType: 'json',
    headers: {
        'Accept': 'application/dns-json',
    },
});

// high.fi API
module.exports.high = got.extend({
    prefixUrl: 'https://high.fi',
    timeout: 2000,
    responseType: 'json',
    headers: {
        'Content-Type': 'application/json;charset=utf-8',
    },
});

module.exports.twitchAuth = got.extend({
    prefixUrl: 'https://id.twitch.tv',
    responseType: 'json',
});

// Twitch API v5
module.exports.kraken = got.extend({
    prefixUrl: 'https://api.twitch.tv/kraken',
    timeout: 1500,
    responseType: 'json',
    headers: {
        'Client-ID': sc.Config.twitch.clientid,
        'Accept': 'application/vnd.twitchtv.v5+json',
    },
});

// Twitch Helix API
module.exports.helix = async () => {
    return got.extend({
        prefixUrl: 'https://api.twitch.tv/helix',
        timeout: 1500,
        responseType: 'json',
        headers: {
            'Client-ID': sc.Config.twitch.clientid,
            'Authorization': `Bearer ${await sc.Utils.cache.get('oauth-token')}`,
        },
    });
};

// Twitch TMI API
module.exports.tmi = got.extend({
    prefixUrl: 'https://tmi.twitch.tv',
    timeout: 3500,
    responseType: 'json',
});

// Scriptorex API
module.exports.bot = got.extend({
    timeout: 5000,
    responseType: 'json',
    prefixUrl: 'https://api.ivr.fi/',
    headers: {
        'User-Agent': 'Scriptorex || Leppunen@twitch',
    },
});

// Pastebin API
module.exports.paste = got.extend({
    timeout: 500,
    method: 'post',
    responseType: 'json',
    url: 'https://paste.ivr.fi/documents',
});

// Logs API
module.exports.logs = got.extend({
    prefixUrl: 'https://logs.ivr.fi',
    timeout: 2500,
    responseType: 'json',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Modlookup API
module.exports.mod = got.extend({
    prefixUrl: 'https://modlookup.3v.fi/api',
    timeout: 1500,
    responseType: 'json',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Pushover API
module.exports.push = got.extend({
    prefixUrl: 'https://api.pushover.net/1/messages.json',
    method: 'post',

    timeout: 1500,
    responseType: 'json',
    headers: {
        'Content-Type': 'application/json',
    },
    searchParams: {
        token: sc.Config.tokens.pushToken,
        user: sc.Config.tokens.pushUser,
    },
});

// Shodan API
module.exports.shodan = got.extend({
    prefixUrl: 'https://api.shodan.io',
    timeout: 15000,
    responseType: 'json',
    headers: {
        'Content-Type': 'application/json',
    },
    searchParams: {
        key: sc.Config.tokens.shodan,
        minify: true,
    },
});

// Wolfram API
module.exports.wolfram = got.extend({
    prefixUrl: 'https://api.wolframalpha.com/v2',
    timeout: 10000,
    responseType: 'text',
    headers: {
        'Content-Type': 'application/json',
    },
    searchParams: {
        units: 'metric',
        appid: sc.Config.tokens.wolfram,
    },
});

// Dank API
module.exports.dank = got.extend({
    timeout: 5000,
    responseType: 'json',
    prefixUrl: 'https://dank.ivr.fi',
});

// Desktop API
module.exports.desk = got.extend({
    timeout: 1000,
    responseType: 'json',
    prefixUrl: 'http://10.0.0.20:8999',
});

// Supinic API
module.exports.supinic = got.extend({
    timeout: 10000,
    responseType: 'json',
    prefixUrl: 'https://supinic.com/api',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'scriptorex / Leppunen@twitch',
        'Authorization': `Basic ${sc.Config.tokens.supiapi}`,
    },
});

// Mojang API
module.exports.mojang = got.extend({
    timeout: 6000,
    responseType: 'json',
    prefixUrl: 'https://api.mojang.com',
    headers: {
        'Content-Type': 'application/json',
    },
});

// XKCD API
module.exports.xkcd = got.extend({
    timeout: 6000,
    responseType: 'json',
    prefixUrl: 'https://xkcd.com',
    headers: {
        'Content-Type': 'application/json',
    },
});

// 5E7EN API
module.exports.simon36 = got.extend({
    timeout: 6000,
    responseType: 'json',
    prefixUrl: 'https://api.5e7en.me',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'scriptorex / Leppunen@twitch',
    },
});

// pajbot2 API
module.exports.pajbot2 = got.extend({
    timeout: 6000,
    responseType: 'json',
    prefixUrl: 'https://paj.pajbot.com/api',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'scriptorex / Leppunen@twitch',
    },
});

// reddit API
module.exports.reddit = got.extend({
    prefixUrl: 'https://www.reddit.com/r',
    responseType: 'json',
    throwHttpErrors: false,
    headers: {
        'Cookie': '_options={%22pref_quarantine_optin%22:true};',
    },
});
