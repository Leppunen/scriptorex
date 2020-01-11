module.exports.check = (meta) => {
    return this.checkBlacklists(meta) || this.checkWhitelists(meta) || false;
};

module.exports.checkWhitelists = (meta) => {
    const commandData = sc.Command.get(meta.command.Name);

    if (!commandData.Whitelisted) {
        return false;
    }

    const whitelists = sc.Data.filters.filter((i) => i.Command_ID === meta.command.ID && i.Active && i.Mode === 'Whitelist');
    const whitelist = whitelists.find((i) => {
        if (i.User === meta.userid) {
            return Boolean(i.Channel === null || i.Channel === meta.channel.ID);
        }
        if (i.Channel === meta.channel.ID) {
            return Boolean(i.User === null || i.User === meta.userid);
        }
        return false;
    });
    if (!whitelist && commandData.Whitelist_Response) {
        return commandData.Whitelist_Response;
    } else if (!whitelist) {
        return 'not-whitelisted';
    } else {
        return false;
    }
};

module.exports.checkBlacklists = (meta) => {
    const blacklists = sc.Data.filters.filter((i) => i.Active && i.Mode === 'Blacklist');
    const blacklist = blacklists.find((i) => {
        if (i.User === meta.userid) {
            return Boolean(
                (i.Channel === null || i.Channel === meta.channel.ID) &&
                (i.Command_ID === null || i.Command_ID === meta.command.ID),
            );
        } else if (i.Channel === meta.channel.ID) {
            return Boolean(
                (i.User === null || i.User === meta.userid) &&
                (i.Command_ID === null || i.Command_ID === meta.command.ID),
            );
        } else if (i.Command === meta.command.ID) {
            return Boolean(
                (i.Channel === null || i.Channel === meta.channel.ID) &&
                (i.User === null || i.User === meta.userid),
            );
        } else if (i.Platform === meta.platform) {
            return Boolean(
                (i.User === null || i.User === meta.userid) &&
                (i.Channel === null || i.Channel === meta.channel.ID) &&
                (i.Command_ID === null || i.Command_ID === meta.command.ID),

            );
        }
        return false;
    });
    if (!blacklist) return false;

    if (blacklist.Response) {
        return blacklist.Response;
    } else {
        sc.Logger.json(blacklist);
        return 'filtered';
    }
};
