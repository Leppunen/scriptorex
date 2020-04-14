module.exports.get = async (meta, opts = {}) => {
    const kwData = sc.Data.keywords.find((i) => i.Channel === meta.channelMeta.ID && new RegExp(`^${i.Name}$`, i.Case_Sensitive === 1 ? 'gu' : 'giu').test(meta.message.text));
    const user = await sc.Modules.user.get({Platform: meta.platform, id: meta.user.id, name: meta.user.login});

    if (!kwData) {
        return null;
    }

    if (await sc.Utils.cache.get(`cooldown-kword-${meta.channelMeta.ID}-${kwData.Name}`)) {
        return null;
    }

    if (kwData.User && kwData.User !== user.ID) {
        return null;
    }

    let kwResp = kwData.Reply;

    // Check the keyword reply against banphrases
    if (!kwData.SkipBanphrases) {
        kwResp = await sc.Modules.banphrase.custom(meta.channel, kwResp);
        kwResp = await sc.Modules.banphrase.pajbot(meta, kwResp);
    }

    if (kwData.Cooldown && opts.setCooldown) {
        await sc.Utils.cache.set(`cooldown-kword-${meta.channelMeta.ID}-${kwData.Name}`, 'true', kwData.Cooldown);
    }

    return kwResp;
};

