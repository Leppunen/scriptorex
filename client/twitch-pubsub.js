const WebSocket = require('ws');
const chalk = require('chalk');
const crypto = require('crypto');

const ps = new WebSocket('wss://pubsub-edge.twitch.tv');

ps.on('open', () => {
    sc.Logger.info(`${chalk.green('[CONNECTED]')} || Connected to Twitch PubSub. Subscribing to topics.`);
    for (const channel of sc.Channel.getJoinable('Twitch')) {
        listenStreamStatus(channel);
    }
});

ps.on('message', (data) => {
    const msg = JSON.parse(data);
    switch (msg.type) {
    case 'PONG':
        // sc.Logger.debug('Received a PONG from PubSub');
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
                handleWSMsg({channel: msgTopic.replace('video-playback.', ''), live: true, viewcount: msgData.viewers});
                break;
            case 'commercial':
                break;
            case 'stream-up':
                handleWSMsg({channel: msgTopic.replace('video-playback.', ''), live: true});
                break;
            case 'stream-down':
                handleWSMsg({channel: msgTopic.replace('video-playback.', ''), live: false});
                break;
            default:
                sc.Logger.warn(`Unknown topic message type: [${msgTopic}] ${msgData.type}`);
            }
        } else {
            sc.Logger.warn(`No data associated with message [${JSON.stringify(msg)}]`);
        }
        break;
    default:
        sc.Logger.warn(`Unknown PubSub Message Type: ${msg.type}`);
    }
});

const listenStreamStatus = (channel) => {
    const channelMeta = sc.Channel.get(channel);
    if (!channelMeta.Name) return null;
    channelMeta.pubsubTopics = [];
    const nonce = crypto.randomBytes(20).toString('hex').slice(-8);
    channelMeta.pubsubTopics.push({topic: 'video-playback', nonce: nonce});
    const message = {
        'type': 'LISTEN',
        'nonce': nonce,
        'data': {
            'topics': [`video-playback.${channelMeta.Name}`],
            'auth_token': sc.Config.twitch.token,
        },
    };
    ps.send(JSON.stringify(message));
};

const handleWSMsg = async (msg = {}) => {
    const channelMeta = sc.Channel.get(msg.channel);
    if (!channelMeta.Name) return null;

    if (msg.live === true && !channelMeta.streamLive) {
        sc.Logger.debug(`Channel ${channelMeta.Name} went live`);
        channelMeta.streamLive = true;
    } else if (msg.live === false) {
        sc.Logger.debug(`Channel ${channelMeta.Name} went offline`);
        channelMeta.streamLive = false;
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
        sc.Logger.warn(`Error occurred while subscribing to topic for ${channelMeta.Name}: ${msg.error}`);
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
