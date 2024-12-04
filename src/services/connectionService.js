const { conn_webhook } = require("../config/db");
const getConnection = async () => {
  try {
    return await conn_webhook.getConnection();
  } catch (error) {
    console.error("Failed to get a connection:", error);
    throw error;
  }
};

module.exports = {
  getConnection
};
