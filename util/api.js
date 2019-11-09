const axios = require('axios');
const config = require('../config');
const {setupCache} = require('axios-cache-adapter');

const cache30min = setupCache({
    maxAge: 30 * 60 * 1000,
});

const cache30sec = setupCache({
    maxAge: 30000,
});

// Generic pajbot Banphrases
module.exports.ban = axios.create({
    method: 'post',
    timeout: 1500,
});

// Generic GET requests
module.exports.generic = axios.create({
    timeout: 1500,
});

// DNSApi
module.exports.dns = axios.create({
    baseURL: 'https://cloudflare-dns.com/dns-query',
    timeout: 800,
    headers: {
        'Accept': 'application/dns-json',
    },
});

// GithubAPI
module.exports.git = axios.create({
    baseURL: 'https://api.github.com/',
    timeout: 1000,
});

// high.fi API
module.exports.high = axios.create({
    baseURL: 'https://high.fi/',
    timeout: 2000,
    headers: {
        'Content-Type': 'application/json;charset=utf-8',
    },
});

// Sinusbot API
module.exports.sinus = axios.create({
    baseURL: 'https://sinusbot.ivr.fi/api/v1',
    timeout: 1000,
    headers: {
        'Authorization': 'Bearer ' + config.tokens.sinus,
        'Content-Type': 'application/json',
    },
});

// Twitch API v5
module.exports.kraken = axios.create({
    baseURL: 'https://api.twitch.tv/kraken',
    timeout: 1500,
    headers: {
        'Client-ID': config.tokens.kraken,
        'Accept': 'application/vnd.twitchtv.v5+json',
    },
});

// Twitch Helix API
module.exports.helix = axios.create({
    baseURL: 'https://api.twitch.tv/helix',
    timeout: 1500,
    headers: {
        'Client-ID': config.tokens.kraken,
    },
});

// Twitch TMI API
module.exports.tmi = axios.create({
    baseURL: 'https://tmi.twitch.tv/',
    timeout: 1500,
});

// Scriptorex API
module.exports.bot = axios.create({
    adapter: cache30sec.adapter,
    timeout: 5000,
    baseURL: 'https://api.ivr.fi',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Scriptorex || Leppunen@twitch',
    },
});

// Scriptorex API No Cache
module.exports.botnc = axios.create({
    timeout: 8000,
    baseURL: 'https://api.ivr.fi',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Scriptorex || Leppunen@twitch',
    },
});

// Pastebin API
module.exports.paste = axios.create({
    timeout: 500,
    method: 'post',
    baseURL: 'https://paste.ivr.fi/documents',
});

// Logs API
module.exports.logs = axios.create({
    baseURL: 'https://logs.ivr.fi',
    timeout: 800,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Modlookup API
module.exports.mod = axios.create({
    adapter: cache30min.adapter,
    baseURL: 'https://modlookup.3v.fi/api/',
    timeout: 1500,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Pushover API
module.exports.push = axios.create({
    baseURL: 'https://api.pushover.net/1/messages.json',
    method: 'post',
    timeout: 1000,
    headers: {
        'Content-Type': 'application/json',
    },
    data: {
        token: config.tokens.pushToken,
        user: config.tokens.pushUser,
    },
});

// Shodan API
module.exports.shodan = axios.create({
    baseURL: 'https://api.shodan.io',
    timeout: 800,
    headers: {
        'Content-Type': 'application/json',
    },
    params: {
        key: config.tokens.shodan,
        minify: true,
    },
});

// Wolfram API
module.exports.wolfram = axios.create({
    baseURL: 'https://api.wolframalpha.com/v2',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
    params: {
        units: 'metric',
        podindex: '1,2,3',
        format: 'plaintext',
        excludepodid: 'VisualForm',
        appid: config.tokens.wolfram,
        output: 'json',
    },
});

// Dank API
module.exports.dank = axios.create({
    timeout: 5000,
    baseURL: 'https://dank.ivr.fi',
});

// Desktop API
module.exports.desk = axios.create({
    timeout: 1000,
    baseURL: 'http://10.0.0.20:8999/',
});

// Supinic API
module.exports.supinic = axios.create({
    timeout: 10000,
    baseURL: 'https://supinic.com/api',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'scriptorex / Leppunen@twitch',
        'Authorization': `Basic ${config.tokens.supiapi}`,
    },
});

// Bilibili API
module.exports.bilibili = axios.create({
    timeout: 6000,
    baseURL: 'https://api.bilibili.com',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Mojang API
module.exports.mojang = axios.create({
    timeout: 6000,
    baseURL: 'https://api.mojang.com',
    headers: {
        'Content-Type': 'application/json',
    },
});

// XKCD API
module.exports.xkcd = axios.create({
    timeout: 6000,
    baseURL: 'https://xkcd.com',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Dubtrack API
module.exports.dubtrack = axios.create({
    timeout: 6000,
    baseURL: 'https://api.dubtrack.fm',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Azure Function API
module.exports.azure = axios.create({
    timeout: 10000,
    baseURL: 'https://ivr-dankapi.azurewebsites.net',
    headers: {
        'Content-Type': 'application/json',
        'x-functions-key': config.tokens.azure,
    },
});

