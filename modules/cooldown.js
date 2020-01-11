
module.exports = (cmdMeta, meta, options = {}) => {
    if (!options.Level) {
        options.Level = 'UserCommand';
    }

    if (!options.Mode) {
        options.Mode = 'add';
    }

    const channelData = sc.Data.channels.find((chn) => chn.Name === cmdMeta.channel) || {};

    if (!sc.Cooldowns) {
        sc.Cooldowns = {};
        sc.Cooldowns.Discord = {};
        sc.Cooldowns.Twitch = {};
        sc.Cooldowns.Twitch.Whispers = {};
    }
    if (cmdMeta.platform === 'Twitch') {
        if (cmdMeta.type === 'whisper') {
            sc.Cooldowns.Twitch.Whispers[cmdMeta.user.id] = {name: cmdMeta.user.login, cooldown: 0};
        } else {
            if (!sc.Cooldowns.Twitch[cmdMeta.channelid]) {
                sc.Cooldowns.Twitch[cmdMeta.channelid] = {name: cmdMeta.channel, cooldown: 0};
            }

            if (!sc.Cooldowns.Twitch[cmdMeta.channelid][meta.name]) {
                sc.Cooldowns.Twitch[cmdMeta.channelid][meta.name] = {cooldown: 0};
            }

            if (!sc.Cooldowns.Twitch[cmdMeta.channelid][cmdMeta.user.id]) {
                sc.Cooldowns.Twitch[cmdMeta.channelid][cmdMeta.user.id] = {name: cmdMeta.user.name, login: cmdMeta.user.login, id: cmdMeta.user.id, cooldown: 0};
            }
        }
    }

    if (cmdMeta.platform === 'Discord') {
        if (!sc.Cooldowns.Discord[cmdMeta.channelid]) {
            sc.Cooldowns.Discord[cmdMeta.channelid] = {name: cmdMeta.channel, server: cmdMeta.discord.guild, serverid: cmdMeta.discord.guildid, cooldown: 0};
        }

        if (!sc.Cooldowns.Discord[cmdMeta.channelid][meta.name]) {
            sc.Cooldowns.Discord[cmdMeta.channelid][meta.name] = {cooldown: 0};
        }

        if (!sc.Cooldowns.Discord[cmdMeta.channelid][cmdMeta.user.id]) {
            sc.Cooldowns.Discord[cmdMeta.channelid][cmdMeta.user.id] = {name: cmdMeta.user.name, login: cmdMeta.user.login, id: cmdMeta.user.id, cooldown: 0};
        }
    }

    const now = Date.now();

    const object = sc.Cooldowns[cmdMeta.platform][cmdMeta.channelid];

    if (options.Mode === 'add') {
        if (options.Level === 'Whisper') {
            sc.Cooldowns.Twitch.Whispers[cmdMeta.user.id] = {cooldown: now + (meta.userCooldown || sc.Config.parms.whispercd)};
        }

        if (options.Level === 'User') {
            object[cmdMeta.user.id] = {cooldown: now + (meta.UserCooldown || channelData.UserCooldown || sc.Config.parms.usercd)};
        }

        if (options.Level === 'Channel') {
            object[meta.name] = {cooldown: now + (meta.Cooldown || channelData.Cooldown || sc.Config.parms.defaultcd)};
        }

        if (options.Level === 'UserCommand') {
            object[cmdMeta.user.id][meta.name] = {cooldown: now + (meta.UserCooldown || channelData.UserCooldown || sc.Config.parms.defaultcd)};
        }

        if (options.Level === 'UserCommandChannel') {
            object[cmdMeta.user.id][meta.name] = {cooldown: now + (meta.UserCooldown || channelData.UserCooldown || sc.Config.parms.defaultcd)};
            object[meta.name] = {cooldown: now + (meta.Cooldown || channelData.Cooldown || sc.Config.parms.defaultcd)};
        }
    }

    if (options.Mode === 'check') {
        if (!cmdMeta.channel) {
            if (sc.Cooldowns.Twitch.Whispers[cmdMeta.user.id].cooldown > now) {
                return true;
            } else {
                return false;
            }
        }

        const targetUser = object[cmdMeta.user.id];
        if (targetUser.cooldown > now) {
            return true;
        }

        const targetCmd = object[meta.name];
        if (targetCmd.cooldown > now) {
            return true;
        }

        const targetUserCmd = object[cmdMeta.user.id][meta.name];
        if (targetUserCmd && targetUserCmd.cooldown > now) {
            return true;
        }

        return false;
    }
};
