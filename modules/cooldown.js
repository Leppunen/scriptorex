
module.exports = (channel, user, meta, options) => {
    options = options || {};
    options = {'Mode': options.Mode || 'add', 'Level': options.Level || 'UserCommand'};

    const channelData = bot.data.channels.find((chn) => chn.Name === channel);

    if (!channelData.Cooldowns) {
        channelData.Cooldowns = {};
    }

    if (!channelData.Cooldowns[meta.name]) {
        channelData.Cooldowns[meta.name] = {cooldown: 0};
    }

    if (!channelData.Cooldowns[user.id]) {
        channelData.Cooldowns[user.id] = {name: user.name, login: user.login, cooldown: 0};
    }

    const now = Date.now();
    const object = channelData.Cooldowns;

    if (options.Mode === 'add') {
        if ((meta.ChannelCooldown === 0 && !meta.UserCooldown === 0) || meta.OverrideCooldowns === true) {
            return false;
        }

        if (options.Level === 'User') {
            object[user.id] = {cooldown: now + (meta.UserCooldown || channelData.UserCooldown || config.parms.usercd)};
        }

        if (options.Level === 'Channel') {
            object[meta.name] = {cooldown: now + (meta.Cooldown || channelData.Cooldown || config.parms.defaultcd)};
        }

        if (options.Level === 'UserCommand') {
            object[user.id][meta.name] = {cooldown: now + (meta.UserCooldown || channelData.UserCooldown || config.parms.defaultcd)};
        }

        if (options.Level === 'UserCommandChannel') {
            object[user.id][meta.name] = {cooldown: now + (meta.UserCooldown || channelData.UserCooldown || config.parms.defaultcd)};
            object[meta.name] = {cooldown: now + (meta.Cooldown || channelData.Cooldown || config.parms.defaultcd)};
        }
    }

    if (options.Mode === 'check') {
        const targetUser = object[user.id];
        if (targetUser.cooldown > now) {
            return true;
        }

        const targetCmd = object[meta.name];
        if (targetCmd.cooldown > now) {
            return true;
        }

        const targetUserCmd = object[user.id][meta.name];
        if (targetUserCmd && targetUserCmd.cooldown > now) {
            return true;
        }

        return false;
    }
};
