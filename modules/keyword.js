module.exports.check = (meta) => {
    return Boolean(sc.Data.keywords.find((i) => i.Channel === meta.channelMeta.ID && new RegExp(i.Exact ? `^${i.Name}$` : i.Name, i.Case_Sensitive === 1 ? 'gu' : 'giu').test(meta.message.text)));
};

module.exports.get = async (meta) => {
    const kwData = sc.Data.keywords.find((i) => i.Channel === meta.channelMeta.ID && new RegExp(i.Exact ? `^${i.Name}$` : i.Name, i.Case_Sensitive === 1 ? 'gu' : 'giu').test(meta.message.text));
    const user = await sc.Modules.user.get({Platform: meta.platform, id: meta.user.id, name: meta.user.login});

    if (!kwData) {
        return null;
    }

    if (await sc.Utils.cache.get(`cooldown-kword-${meta.channelMeta.ID}-${kwData.ID}`)) {
        return null;
    }

    if (kwData.User && kwData.User !== user.ID) {
        return null;
    }

    let kwResp;

    switch (kwData.Type) {
    case 'Text':
        kwResp = kwData.Data;
        break;
    case 'Code':
        try {
            kwResp = await eval(kwData.Data)(meta);
        } catch (e) {
            sc.Logger.error(`Keyword ${kwData.ID} Failed -> ${e}`);
            if (e.response) {
                sc.Logger.json(e.response);
            }
            return `Keyword ${kwData.ID} Failed.`;
        }
        break;
    default:
        return null;
    }

    // Check the keyword reply against banphrases
    if (!kwData.SkipBanphrases) {
        kwResp = await sc.Modules.banphrase.custom(meta.channel, kwResp);
        kwResp = await sc.Modules.banphrase.pajbot(meta, kwResp);
    }

    if (kwData.Cooldown) {
        await sc.Utils.cache.set(`cooldown-kword-${meta.channelMeta.ID}-${kwData.ID}`, 'true', kwData.Cooldown);
    }

    await sc.Utils.misc.log(
        'Keyword',
        meta.platform,
        meta.channelMeta.ID,
        user.ID || null,
        `${kwData.Name} ${meta.message.args.join(' ')}`,
        JSON.stringify({
            User: meta.user.name,
            Login: meta.user.login,
            Channel: meta.channel,
            Description: meta.channelMeta.Description,
        },
        null, 2),
        kwResp,
    );

    if (typeof kwResp === 'object') {
        return kwResp;
    } else {
        return String(kwResp);
    }
};

