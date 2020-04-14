const RWS = require('reconnecting-websocket');
const WS = require('ws');
const chalk = require('chalk');
const crypto = require('crypto');

const ps = new RWS('wss://pubsub-edge.twitch.tv', [], {WebSocket: WS, startClosed: true});

module.exports.connect = () => {
    ps.reconnect();
};

ps.addEventListener('open', () => {
    sc.Logger.info(`${chalk.green('[CONNECTED]')} || Connected to Twitch PubSub. Subscribing to topics.`);
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
                handleWSMsg({channel: msgTopic.replace('video-playback.', ''), type: msgData.type, viewcount: msgData.viewers});
                break;
            case 'commercial':
                break;
            case 'stream-up':
            case 'stream-down':
                handleWSMsg({channel: msgTopic.replace('video-playback.', ''), type: msgData.type});
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
        ps.close();
        break;
    default:
        sc.Logger.warn(`Unknown PubSub Message Type: ${msg.type}`);
    }
});

const listenStreamStatus = async (channel) => {
    const channelMeta = sc.Channel.get(channel);
    if (!channelMeta.Name) return null;
    const nonce = crypto.randomBytes(20).toString('hex').slice(-8);
    channelMeta.pubsubTopics.push({topic: 'video-playback', nonce: nonce});
    const message = {
        'type': 'LISTEN',
        'nonce': nonce,
        'data': {
            'topics': [`video-playback.${channelMeta.Name}`],
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
    channelMeta.pubsubTopics.push({topic: 'channel-points', nonce: nonce});
    const message = {
        'type': 'LISTEN',
        'nonce': nonce,
        'data': {
            'topics': [`community-points-channel-v1.${channelMeta.UserID}`],
            'auth_token': await sc.Utils.cache.get('oauth-token'),
        },
    };
    ps.send(JSON.stringify(message));
};

const handleWSMsg = async (msg = {}) => {
    const channelMeta = sc.Channel.get(msg.channel);
    if (!channelMeta.Name) return null;
    if (msg) {
        switch (msg.type) {
        case 'viewcount':
            await sc.Utils.cache.set(`streamLive-${channelMeta.Name}`, 'true', 35);
            break;
        case 'stream-up':
            await sc.Utils.cache.set(`streamLive-${channelMeta.Name}`, 'true', 35);
            if (!channelMeta.streamLive) {
                sc.Logger.debug(`Channel ${channelMeta.Name} went live`);
                channelMeta.streamLive = true;
                if (channelMeta.Name === 'supinic' || channelMeta.Name === 'pajlada') {
                    await sc.Twitch.say(channelMeta.Name, 'HONEYDETECTED 👉 Channel is live!');
                }
            }
            break;
        case 'stream-down':
            await sc.Utils.cache.redis.del(`streamLive-${channelMeta.Name}`);
            sc.Logger.debug(`Channel ${channelMeta.Name} went offline`);
            channelMeta.streamLive = false;
            if (channelMeta.Name === 'supinic') {
                await sc.Twitch.say(channelMeta.Name, 'peepoSadDank 👉 Channel is offline!');
            }
            break;
        case 'reward-redeemed':
            await sc.Twitch.say(channelMeta.Name, `HONEYDETECTED 👉 CHANNELPOINTREDEMPTIONDETECTED By ${msg.data.user.display_name} -> [${msg.data.reward.title}]`);
            break;
        }
    }
};

const handleWSResp = (msg) => {
    if (!msg.nonce) {
        return sc.Logger.warn(`Unknown message without nonce: ${JSON.stringify(msg)}`);
    }

    const channelMeta = sc.Data.channels.find((chn) => chn.pubsubTopics && chn.pubsubTopics.some((i) => i.nonce === msg.nonce));
    const topicMeta = channelMeta.pubsubTopics.find((i) => i.nonce === msg.nonce);
    if (!channelMeta.Name || !topicMeta) return null;

    if (msg.error) {
        sc.Logger.warn(`Error occurred while subscribing to topic ${topicMeta.topic} for ${channelMeta.Name}: ${msg.error}`);
    } else {
        sc.Logger.info(`Successfully subscribed to topic ${topicMeta.topic} for ${channelMeta.Name}`);
    }
};

// Keepalive

setInterval(() => {
    ps.send(JSON.stringify({
        type: 'PING',
    }));
}, 250 * 1000);
