const Discord = require('eris');
const chalk = require('chalk');
const client = new Discord.Client(sc.Config.discord.token);

client.on('ready', () => {
    sc.Logger.info(`${chalk.green('[CONNECTED]')} || Connected to Discord.`);
});

client.on('warn', (msg, id) => {
    sc.Logger.warn(`Warning occurred in Eris: ${id} -> ${msg}`);
});

client.on('error', (msg, id) => {
    sc.Logger.error(`Error occurred in Eris: ${id} -> ${msg}`);
});

client.on('messageCreate', async (msg) => {
    // Ignore messages not tied to a guild.
    if (!msg.channel.guild) {
        return;
    }

    // Ignore if from self
    if (msg.author.id === sc.Config.discord.ID) {
        return;
    }

    // Ignore if message does not start with prefix
    if (!msg.content.startsWith(sc.Config.parms.prefix)) {
        return;
    }

    const message = msg.content.replace(sc.Config.parms.msgregex, '');
    const channelMeta = sc.Data.channels.find((chn) => chn.Name === msg.channel.id) || {};

    // Create a channel in the database if it does not exist
    if (Object.entries(channelMeta).length === 0) {
        await sc.Utils.db.query('INSERT INTO Channel (Name, Description, Platform, UserID) VALUES (?, ?, ?, ?)', [msg.channel.id, `Channel ${msg.channel.name} in Server ${msg.channel.guild.name}`, 'Discord', msg.channel.guild.id]);
    }

    const content = message.split(/\s+/g);
    const command = content[0];
    const commandstring = command.slice(sc.Config.parms.prefix.length);
    const args = content.slice(1);
    const cmdData = {
        'user': {
            'id': msg.author.id,
            'name': `${msg.author.username}#${msg.author.discriminator}`,
            'login': msg.author.username,
            'mentionString': msg.author.mention,
        },
        'message': {
            'text': message,
            'args': args,
        },
        'discord': {
            'guildid': msg.channel.guild.id,
            'guild': msg.channel.guild.name,
            'channel': msg.channel.name,
            'channelid': msg.channel.id,
            'messageid': msg.id,
        },
        'platform': 'Discord',
        'command': commandstring,
        'channel': msg.channel.name,
        'channelid': msg.channel.id,
        'channelMeta': channelMeta,
        'msgObj': msg,
    };

    const userMeta = await sc.Modules.user.get({Platform: cmdData.platform, id: cmdData.user.id, name: cmdData.user.login});
    const cmdMeta = sc.Command.get(commandstring);

    // No command found. Do nothing.
    if (!cmdMeta) {
        return;
    }

    if (sc.Modules.cooldown(cmdData, {name: cmdMeta.Name}, {'Mode': 'check'})) {
        return;
    }

    try {
        const cmdRun = await sc.Command.execute(commandstring, cmdData, userMeta);
        if (cmdRun.state === false) {
            return await send(cmdData, `Command Error: ${cmdRun.data}`);
        }
        sc.Temp.cmdCount++;

        if (!cmdRun.data) {
            return await send(cmdData, 'Command returned no data.');
        }
        return await send(cmdData, cmdRun.data);
    } catch (e) {
        await sc.Utils.misc.dberror(e.name, e.message, e.stack);
        if (e instanceof SyntaxError) {
            sc.Logger.warn(`${chalk.red('[SyntaxError]')} || ${e.name} -> ${e.message} ||| ${e.stack}`);
            return await send(cmdData, 'This command has a Syntax Error.');
        }
        if (e instanceof TypeError) {
            sc.Logger.warn(`${chalk.red('[TypeError]')} || ${e.name} -> ${e.message} ||| ${e.stack}`);
            return await send(cmdData, 'This command has a Type Error.');
        }
        await send(cmdData, 'Error occurred while executing the command.');
        return sc.Logger.error(`Error executing command: (${e.name}) -> ${e.message} ||| ${e.stack}`);
    }
});

const send = async (meta, msg) => {
    msg = msg.replace(/\n|\r/g, '');
    try {
        // Trim the message to the discord message limit or lower if configured
        let lengthLimit = meta.channelMeta.Length || sc.Config.parms.discordLenLimit;
        lengthLimit -= 2;
        let message = msg.substring(0, lengthLimit);
        if (message.length < msg.length) {
            message = msg.substring(0, lengthLimit - 1) + '…';
        }

        await client.createMessage(meta.channelid, message);
    } catch (e) {
        await client.createMessage(meta.channelid, 'Error while processing the reply message');
        sc.Logger.error(`Error while processing reply message: ${e}`);
        await sc.Utils.misc.dberror('SendError', e.message, e.stack);
    }
};

module.exports = client;
