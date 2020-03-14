module.exports.get = (channel) => {
    const channelData = sc.Data.channels.find((chn) => chn.Name === channel || chn.UserID === channel);

    if (!channelData) {
        return {};
    }

    if (!Array.isArray(channelData.pubsubTopics)) {
        channelData.pubsubTopics = [];
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

module.exports.getJoinable = (platform) => {
    switch (platform) {
    case 'Twitch':
        return sc.Data.channels.filter((channel) => channel.Connect === 1 && channel.Platform === 'Twitch').map((channel) => channel.Name);
    case 'Discord':
        return sc.Data.channels.filter((channel) => channel.Connect === 1 && channel.Platform === 'Discord').map((channel) => channel.Name);
    default:
        return null;
    }
};
