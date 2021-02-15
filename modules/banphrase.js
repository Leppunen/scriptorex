/* eslint-disable camelcase */
const chalk = require('chalk');
module.exports.pajbot = async (meta, msg) => {
    if (meta.channelMeta.Banphrase_URL) {
        try {
            const {banned, banphrase_data} = await sc.Utils.got.ban(`https://${meta.channelMeta.Banphrase_URL}/api/v1/banphrases/test`, {json: {'message': msg}}).json();
            if (banned) {
                sc.Logger.warn(`${chalk.red('[BANPHRASE]')} || Banphrase triggered in ${chalk.green(meta.channel)} -> ID: ${banphrase_data.id} [${chalk.magenta(banphrase_data.phrase)}]`);
                await sc.Utils.misc.log('Banphrase', meta.platform, meta.channelMeta.ID, meta.userMeta.ID, msg, null, banphrase_data);
                return 'No can do, Response contains a banned phrase.';
            } else {
                return msg;
            }
        } catch (err) {
            sc.Logger.warn(`${chalk.red('[BANPHRASE]')} || Failed to check for banphrases in ${chalk.green(meta.channel)} -> ${chalk.magenta(err.message)}`);
            return 'No can do, Failed to check for banphrases monkaS';
        }
    } else {
        return msg;
    }
};

module.exports.checkHeight = async (meta, msg) => {
    try {
        const {banned, filter_data, input_message} = await sc.Utils.got.pajbot2(`channel/${meta.Platform_ID}/moderation/check_message`, {searchParams: {message: msg}}).json();
        if (banned && filter_data[0].reason.includes('Your message is too tall:')) {
            sc.Logger.warn(`${chalk.red('[BANPHRASE]')} || pajbot2 height limit triggered in ${chalk.green(meta.Name)} -> ${chalk.magenta(input_message)}`);
            return 'The reply is too tall for this channel.';
        } else {
            return msg;
        }
    } catch (err) {
        sc.Logger.warn(`${chalk.red('[BANPHRASE]')} || Failed to check for pajbot2 banphrases in ${chalk.green(meta.Name)} -> ${chalk.magenta(err.message)}`);
        return 'No can do, Failed to check for height monkaS';
    }
};

module.exports.checkMassping = async (channel, msg) => {
    try {
        const chatterList = await sc.Utils.twitch.chatters(channel);
        const pingCount = msg.split(' ').reduce((a, b) => a + chatterList.includes(b.toLowerCase()), 0);
        if (pingCount > sc.Config.twitch.maxPingCount) {
            return 'The reply pings too many users in chat.';
        } else {
            return msg;
        }
    } catch (err) {
        return 'No can do, Failed to check for masspings monkaS';
    }
};

module.exports.custom = async (channel, msg) => {
    const phrases = sc.Data.banphrase.filter((data) => (
        (channel === data.Channel) || (!data.Channel)
    ));
    for (const banphrase of phrases) {
        switch (banphrase.Type) {
        case 'String':
        case 'Regex':
            if (new RegExp(banphrase.Data, banphrase.MatchCase === 1 ? 'gu' : 'giu').test(msg)) {
                if (banphrase.Mode === 'Reply') {
                    return banphrase.Reply;
                } else {
                    try {
                        if (banphrase.MatchCase === 1) {
                            msg = msg.replace(new RegExp(banphrase.Data, 'gu'), banphrase.Reply !== null ? banphrase.Reply : '[B]');
                        } else {
                            msg = msg.replace(new RegExp(banphrase.Data, 'giu'), banphrase.Reply !== null ? banphrase.Reply : '[B]');
                        }
                    } catch (e) {
                        sc.Logger.error(`Banphrase ${banphrase.ID} Failed -> ${e}`);
                        return `Banphrase ${banphrase.ID} Failed.`;
                    }
                }
            }
            break;
        case 'Code':
            try {
                msg = await eval(banphrase.Data)(msg);
            } catch (e) {
                sc.Logger.error(`Banphrase ${banphrase.ID} Failed -> ${e}`);
                return `Banphrase ${banphrase.ID} Failed.`;
            }
            break;
        default:
            return `Banphrase ${banphrase.ID} has an invalid type: ${banphrase.Type}`;
        }
    }
    return msg;
};
