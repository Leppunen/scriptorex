module.exports.check = (meta) => {
    const channelKeywords = sc.Data.keywords.filter((i) => i.Channel === meta.channelMeta.ID);
    const keyword = channelKeywords.find((i) => {
        switch (i.Match) {
        case 'Exact':
            return new RegExp(`^${i.Name}$`, i.Case_Sensitive === 1 ? 'gu' : 'giu').test(meta.message.text);
        case 'StartsWith':
            return new RegExp(`^${i.Name}$`, i.Case_Sensitive === 1 ? 'gu' : 'giu').test(meta.message.content[0]);
        case 'Contains':
            return new RegExp(`\\b${i.Name}\\b`, i.Case_Sensitive === 1 ? 'gu' : 'giu').test(meta.message.text);
        case 'CustomRegex':
            return new RegExp(i.Name, i.Case_Sensitive === 1 ? 'gu' : 'giu').test(meta.message.text);
        }
    });
    if (keyword) {
        sc.Logger.debug(`[${keyword.ID}/${keyword.Name} | (${keyword.Match})] -> Executed by ${meta.user.login} in channel ${meta.channel} using [${meta.message.text}]`);
        return keyword.ID;
    } else {
        return null;
    }
};

module.exports.get = async (meta, id) => {
    const kwData = sc.Data.keywords.find((i) => i.ID === id);
    const user = await sc.Modules.user.get({Platform: meta.platform, id: meta.user.id, name: meta.user.login});

    if (!kwData) {
        return null;
    }

    if (await sc.Utils.cache.get(`cooldown-kword-${meta.channelMeta.ID}-${kwData.ID}`)) {
        return null;
    }

    if (kwData.Cooldown) {
        await sc.Utils.cache.set(`cooldown-kword-${meta.channelMeta.ID}-${kwData.ID}`, 'true', kwData.Cooldown);
    }

    if (kwData.User && kwData.User !== user.ID) {
        return null;
    }

    if (typeof kwData.Extra !== 'object') {
        kwData.Extra = JSON.parse(kwData.Extra);
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
            sc.Logger.error(`Keyword ${kwData.ID}/${kwData.Name} Failed in channel ${meta.channel} -> ${e}`);
            await sc.Utils.cache.del(`cooldown-kword-${meta.channelMeta.ID}-${kwData.ID}`);
            if (e instanceof sc.Utils.got.generic.HTTPError) {
                return {error: true, response: `Keyword ${kwData.ID} Failed (Unexpected HTTP error).`, extra: kwData.Extra};
            }
            if (e instanceof sc.Utils.got.generic.TimeoutError) {
                return {error: true, response: `Keyword ${kwData.ID} Failed (Connection timed out).`, extra: kwData.Extra};
            }
            if (e.response) {
                sc.Logger.json(e.response);
            }
            return {error: true, response: `Keyword ${kwData.ID} Failed.`, extra: kwData.Extra};
        }
        break;
    default:
        return null;
    }

    // Check the keyword reply against banphrases
    if (!kwData.SkipBanphrases && kwResp) {
        kwResp = await sc.Modules.banphrase.custom(meta.channel, kwResp);
        kwResp = await sc.Modules.banphrase.pajbot(meta, kwResp);
    }

    if (!kwData.Extra.NoLog) {
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
            kwResp ?? '[No Data]',
    );
    }

    return {response: kwResp, extra: kwData.Extra};
};

