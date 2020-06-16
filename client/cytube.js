const Cytube = require('cytube-connector');
const chalk = require('chalk');

const clients = {};

module.exports.clients = clients;

module.exports.initialize = () => {
    const channels = sc.Channel.getJoinable('Cytube');

    if (channels.length === 0) {
        return sc.Logger.error('No Cytube channels configured');
    }

    for (const channel of channels) {
        clients[channel] = new Cytube({
            host: 'cytu.be',
            port: 443,
            secure: true,
            user: sc.Config.cytube.username,
            auth: sc.Config.cytube.password,
            chan: channel,
        });

        const client = clients[channel];

        client.userMap = new Map();

        client.on('clientready', () => {
            sc.Logger.info(`${chalk.green('[CONNECTED]')} || Connected to Cytube channel ${chalk.magenta(channel)}.`);
        });

        client.on('error', (e) => {
            sc.Logger.error(`Error occurred in Cytube channel ${channel} -> ${e}`);
        });

        client.on('userlist', (data = []) => {
            for (const record of data) {
                if (typeof record.name === 'string') {
                    record.name = record.name.toLowerCase();
                    client.userMap.set(record.name, record);
                }
            }
        });

        client.on('addUser', (data) => {
            if (typeof data.name === 'string') {
                data.name = data.name.toLowerCase();
                client.userMap.set(data.name, data);
            }
        });

        client.on('userLeave', (data) => {
            data.name = data.name.toLowerCase();
            client.userMap.delete(data.name);
        });

        client.on('chatMsg', async (data) => {
            await handleMessage({client: client, channel: channel, data: data});
        });
    }
};

const handleMessage = async ({client, channel, data}) => {
    const difference = (Date.now() - data.time);
    if (data.time && difference > 60.0e3) {
        return;
    }

    if (data.username === sc.Config.cytube.username) {
        return;
    }

    if (data.meta.shadow) {
        return;
    }

    const channelMeta = sc.Channel.get(channel);

    const message = data.msg.replace(sc.Config.parms.msgregex, '');
    const content = message.split(/\s+/g);
    const command = content[0];
    const commandstring = command.slice(sc.Config.parms.prefix.length);
    const args = content.slice(1);

    const context = {
        user: {
            name: data.username,
            id: data.username,
            login: data.username.toLowerCase(),
        },
        message: {
            raw: data.msg,
            text: message,
            args: args,
            sendTime: data.time,
        },
        cytube: {
            users: client.userMap,
            client: client,
        },
        nsfw: channelMeta?.Extra?.NSFW,
        platform: 'Cytube',
        command: commandstring,
        channel: channel,
        channelid: channel,
        channelMeta: channelMeta,
    };

    context.user.meta = await sc.Modules.user.get({Platform: context.platform, name: context.user.login});

    if (await sc.Modules.keyword.check(context)) {
        const reply = await sc.Modules.keyword.get(context);
        return send(context, reply);
    }

    const cmdMeta = sc.Command.get(commandstring);

    // No command found. Do nothing.
    if (!cmdMeta) {
        return;
    }

    if (await sc.Modules.cooldown(context, {'Mode': 'check'})) {
        return;
    }

    try {
        const cmdRun = await sc.Command.execute(commandstring, context, context.user.meta);
        if (cmdRun.state === false) {
            return send(context, `Command Error: ${cmdRun.data}`);
        }
        sc.Temp.cmdCount++;

        if (!cmdRun.data) {
            return send(context, 'Command returned no data.');
        }

        return send(context, cmdRun.data);
    } catch (e) {
        await sc.Utils.misc.logError(e.name, e.message, e.stack);
        if (e instanceof SyntaxError) {
            sc.Logger.warn(`${chalk.red('[SyntaxError]')} || ${e.name} -> ${e.message} ||| ${e.stack}`);
            return send(context, 'This command has a Syntax Error.');
        }
        if (e instanceof TypeError) {
            sc.Logger.warn(`${chalk.red('[TypeError]')} || ${e.name} -> ${e.message} ||| ${e.stack}`);
            return send(context, 'This command has a Type Error.');
        }
        send(context, 'Error occurred while executing the command.');
        return sc.Logger.error(`Error executing command: (${e.name}) -> ${e.message} ||| ${e.stack}`);
    }
};

const send = (context, msg) => {
    let lengthLimit = 200;
    lengthLimit -= 2;
    let message = msg.substring(0, lengthLimit);
    if (message.length < msg.length) {
        message = msg.substring(0, lengthLimit - 1) + '…';
    }
    context.cytube.client.chat({
        msg: message,
        meta: {},
    });
};
