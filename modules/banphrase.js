const chalk = require('chalk');
module.exports.pajbot = async (meta, msg) => {
    if (meta.channelMeta.Banphrase_URL) {
        try {
            const {data} = await sc.Utils.api.ban(`https://${meta.channelMeta.Banphrase_URL}/api/v1/banphrases/test`, {data: {'message': msg}});
            if (data.banned) {
                sc.Logger.warn(`${chalk.red('[BANPHRASE]')} || Banphrase triggered in ${chalk.green(meta.channel)} -> ${chalk.magenta(data.banphrase_data.phrase)}`);
                await sc.Utils.misc.dblog('Banphrase', meta.channel, meta.user.name, meta.user.id, msg, null, data.banphrase_data);
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
                            msg = msg.replace(new RegExp(banphrase.Data, 'gu'), banphrase.Reply || '[B]');
                        } else {
                            msg = msg.replace(new RegExp(banphrase.Data, 'giu'), banphrase.Reply || '[B]');
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
