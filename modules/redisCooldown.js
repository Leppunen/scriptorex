
module.exports = async ({command, channel, channelid, platform, user: {id, login}}, options = {}) => {
    if (!options.Level) options.Level = 'UserCommand';
    if (!options.Mode) options.Mode = 'add';

    const channelData = sc.Channel.get(channel) ?? {};
    const {Name: cmdName, Cooldown: cmdCooldown, User_Cooldown: cmdUserCooldown} = sc.Command.get(command);
    const userMeta = await sc.Modules.user.get({Platform: platform, id: id, name: login});

    const prefix = `cooldown-${platform}-${channelid}`;

    if (options.Mode === 'add') {
        if (userMeta?.Extra?.BypassCooldowns) {
            return false;
        }

        if (options.Level === 'Disabled') {
            return false;
        }

        if (channelData.Extra?.DisableCooldowns?.includes(cmdName)) {
            return false;
        }

        if (options.Level === 'Whisper') {
            await sc.Utils.cache.setpx(`whispercooldown-${id}`, true, cmdUserCooldown || sc.Config.parms.whispercd);
        }

        if (options.Level === 'User') {
            await sc.Utils.cache.setpx(`${prefix}-${id}`, true, cmdUserCooldown|| channelData.UserCooldown || sc.Config.parms.usercd);
        }

        if (options.Level === 'Channel') {
            await sc.Utils.cache.setpx(`${prefix}-${cmdName}`, true, cmdCooldown || channelData.Cooldown || sc.Config.parms.defaultcd);
        }

        if (options.Level === 'UserCommand') {
            await sc.Utils.cache.setpx(`${prefix}-${id}-${cmdName}`, true, cmdUserCooldown || channelData.UserCooldown || sc.Config.parms.usercd);
        }

        if (options.Level === 'UserCommandChannel') {
            await sc.Utils.cache.setpx(`${prefix}-${id}-${cmdName}`, true, cmdUserCooldown || channelData.UserCooldown || sc.Config.parms.usercd);
            await sc.Utils.cache.setpx(`${prefix}-${cmdName}`, true, cmdCooldown || channelData.Cooldown || sc.Config.parms.defaultcd);
        }
    }

    if (options.Mode === 'check') {
        if (userMeta?.Extra?.BypassCooldowns) {
            return false;
        }

        if (!channel) {
            return Boolean(await sc.Utils.cache.get(`whispercooldown-${id}`));
        }

        if (await sc.Utils.cache.get(`${prefix}-${id}`)) {
            return true;
        }

        if (await sc.Utils.cache.get(`${prefix}-${cmdName}`)) {
            return true;
        }

        if (await sc.Utils.cache.get(`${prefix}-${id}-${cmdName}`)) {
            return true;
        }

        return false;
    }
};
