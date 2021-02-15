module.exports.loadAll = async () => {
    await sc.Command.initialize();
    const changedCmd = await sc.Command.sync();
    sc.Data = {};
    sc.Data.channels = await sc.Utils.db.query('SELECT * from Channel');
    sc.Data.banphrase = await sc.Utils.db.query('SELECT * FROM Banphrase WHERE Enabled = 1');
    sc.Data.cmd = await sc.Utils.db.query('SELECT * from Commands WHERE Active = 1');
    sc.Data.filters = await sc.Utils.db.query('SELECT * from Filters');
    sc.Data.keywords = await sc.Utils.db.query('SELECT * from Keywords WHERE Active = 1');
    sc.Logger.info('Config Loaded');
    return changedCmd;
};
