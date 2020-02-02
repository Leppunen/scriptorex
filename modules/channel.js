module.exports.get = (channel) => {
    const channelData = sc.Data.channels.find((chn) => chn.Name === channel);

    if (!channelData) {
        return {};
    }

    if (channelData.Extra && typeof channelData.Extra !== 'object') {
        try {
            channelData.Extra = JSON.parse(channelData.Extra);
        } catch (e) {
            sc.Logger.error(e);
            sc.Logger.error(`Channel ${channelData.Name} has an invalid meta definition.`);
            channelData.Extra = {};
        }
    }

    return channelData;
};
