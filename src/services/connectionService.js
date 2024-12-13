const db = require("../config/db");

const getWebhookConnection = async () => {
  try {
    return await db.connect_webhook.getConnection();
  } catch (error) {
    console.error("Failed to get a connection from webhook database:", error);
    throw error;
  }
};

const getManageConnection = async () => {
  try {
    return await db.connect_manage.getConnection();
  } catch (error) {
    console.error("Failed to get a connection from manage database:", error);
    throw error;
  }
};

module.exports = {
  getWebhookConnection,
  getManageConnection
};
