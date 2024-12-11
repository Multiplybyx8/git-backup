const mysql = require("mysql2/promise");
require("dotenv").config();

let conn_webhook = createConnectionPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE_WEBHOOK,
  port: process.env.DB_PORT
});

function createConnectionPool(config) {
  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 300,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });

  pool.on("error", function (err) {
    console.log(`MySQL Pool Error (${config.database}): `, err.code);
    if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET" || err.code === "ECONNABORTED") {
      recreatePool(pool, config);
    } else {
      throw err;
    }
  });

  return pool;
}

function recreatePool(pool, config) {
  console.log(`Recreating MySQL Pool for ${config.database}`);
  pool
    .end()
    .then(() => {
      pool = createConnectionPool(config);
    })
    .catch((err) => {
      console.error("Error recreating MySQL pool:", err);
      setTimeout(() => recreatePool(pool, config), 5000); // Retry after 5 seconds
    });
}

module.exports = {
  conn_webhook
};
