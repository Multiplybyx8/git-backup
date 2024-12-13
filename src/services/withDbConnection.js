const connectionService = require("../services/connectionService");
const withDbConnection = async (callback, dbType = "webhook") => {
  let connection;
  try {
    connection =
      dbType === "manage"
        ? await connectionService.getManageConnection()
        : dbType === "webhook"
        ? await connectionService.getWebhookConnection()
        : (() => {
            throw new Error(`Invalid dbType: ${dbType}`);
          })();

    return await callback(connection);
  } catch (error) {
    throw error;
  } finally {
    connection?.release?.();
  }
};

module.exports = {
  withDbConnection
};
