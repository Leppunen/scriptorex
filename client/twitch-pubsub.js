const RWS = require('reconnecting-websocket');
const WS = require('ws');
const chalk = require('chalk');
const crypto = require('crypto');

const ps = new RWS('wss://pubsub-edge.twitch.tv', [], {WebSocket: WS, startClosed: true});

if (!Array.isArray(sc.Temp.pubsubTopics)) {
    sc.Temp.pubsubTopics = [];
}

module.exports.connect = () => {
    ps.reconnect();
};

ps.addEventListener('open', () => {
    sc.Logger.info(`${chalk.green('[PUBSUB]')} || Connected to Twitch PubSub. Subscribing to topics.`);
    for (const channel of sc.Channel.getJoinable('Twitch')) {
        listenStreamStatus(channel);
        listenChannelPoints(channel);
    }
});

ps.addEventListener('message', ({data}) => {
    const msg = JSON.parse(data);
    switch (msg.type) {
    case 'PONG':
        break;

    case 'RESPONSE':
        handleWSResp(msg);
        break;

    case 'MESSAGE':
        if (msg.data) {
            const msgData = JSON.parse(msg.data.message);
            const msgTopic = msg.data.topic;
            switch (msgData.type) {
            case 'viewcount':
                handleWSMsg({channel: msgTopic.replace('video-playback-by-id.', ''), type: msgData.type, viewcount: msgData.viewers});
                break;
            case 'commercial':
                break;
            case 'stream-up':
            case 'stream-down':
                handleWSMsg({channel: msgTopic.replace('video-playback-by-id.', ''), type: msgData.type});
                break;
            case 'reward-redeemed':
                handleWSMsg({channel: msgData.data.redemption.channel_id, type: msgData.type, data: msgData.data.redemption});
                break;
            default:
                sc.Logger.warn(`Unknown topic message type: [${msgTopic}] ${JSON.stringify(msgData)}`);
            }
        } else {
            sc.Logger.warn(`No data associated with message [${JSON.stringify(msg)}]`);
        }
        break;
    case 'RECONNECT':
        sc.Logger.warn('Pubsub server sent a reconnect message. restarting the socket');
        ps.reconnect();
        break;
    default:
        sc.Logger.warn(`Unknown PubSub Message Type: ${msg.type}`);
    }
});

const listenStreamStatus = async (channel) => {
    const channelMeta = sc.Channel.get(channel);
    if (!channelMeta.Name) return null;
    if (!channelMeta.Extra.listenStreamStatus) return null;
    const nonce = crypto.randomBytes(20).toString('hex').slice(-8);
    sc.Temp.pubsubTopics.push({channel: channelMeta.Name, topic: 'video-playback', nonce: nonce});
    const message = {
        'type': 'LISTEN',
        'nonce': nonce,
        'data': {
            'topics': [`video-playback-by-id.${channelMeta.Platform_ID}`],
            'auth_token': await sc.Utils.cache.get('oauth-token'),
        },
    };
    ps.send(JSON.stringify(message));
};

const listenChannelPoints = async (channel) => {
    const channelMeta = sc.Channel.get(channel);
    if (!channelMeta.Name) return null;
    if (!channelMeta.Extra.listenChannelPoints) return null;
    const nonce = crypto.randomBytes(20).toString('hex').slice(-8);
    sc.Temp.pubsubTopics.push({channel: channelMeta.Name, topic: 'channel-points', nonce: nonce});
    const message = {
        'type': 'LISTEN',
        'nonce': nonce,
        'data': {
            'topics': [`community-points-channel-v1.${channelMeta.Platform_ID}`],
            'auth_token': await sc.Utils.cache.get('oauth-token'),
        },
    };
    ps.send(JSON.stringify(message));
};

const handleWSMsg = async (msg = {}) => {
    const channelMeta = sc.Channel.get(msg.channel);
    if (!channelMeta.Name) return null;

    if (!msg.type) {
        return sc.Logger.warn(`Unknown message without type: ${JSON.stringify(msg)}`);
    }


    switch (msg.type) {
    case 'viewcount':
        await sc.Utils.cache.set(`streamLive-${channelMeta.Name}`, 'true', 35);
        break;
    case 'stream-up': {
        const streamLive = await sc.Utils.cache.get(`streamLive-${channelMeta.Name}`);
        if (!streamLive) {
            await sc.Utils.cache.set(`streamLive-${channelMeta.Name}`, 'true', 35);
        }
    }
        break;
    case 'stream-down':
        await sc.Utils.cache.redis.del(`streamLive-${channelMeta.Name}`);
        break;
    case 'reward-redeemed':
        // await sc.Twitch.say(channelMeta.Name, `HONEYDETECTED 👉 CHANNELPOINTREDEMPTIONDETECTED By ${msg.data.user.display_name} -> [${msg.data.reward.title}]`);
        break;
    }
};

const handleWSResp = (msg) => {
    if (!msg.nonce) {
        return sc.Logger.warn(`Unknown message without nonce: ${JSON.stringify(msg)}`);
    }

    const {channel, topic} = sc.Temp.pubsubTopics.find((i) => i.nonce === msg.nonce);
    const {Name} = sc.Channel.get(channel);

    if (msg.error) {
        sc.Logger.warn(`Error occurred while subscribing to topic ${topic} for channel ${Name}: ${msg.error}`);
    } else {
        sc.Logger.info(`${chalk.green('[PUBSUB]')} Successfully subscribed to topic ${chalk.cyan(topic)} for channel ${chalk.magenta(Name)}`);
    }
};

// Keepalive

setInterval(() => {
    ps.send(JSON.stringify({
        type: 'PING',
    }));
}, 250 * 1000);
