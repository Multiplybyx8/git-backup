const mysql = require("mysql2/promise");
require("dotenv").config();

const CONNECTION_LIMIT = 300;
const KEEP_ALIVE_DELAY = 10000;
const RECREATE_RETRY_DELAY = 5000;

// connect database webhook
const connect_webhook = createConnectionPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE_WEBHOOK,
  port: process.env.DB_PORT
});

// connect database manage
const connect_manage = createConnectionPool({
  host: process.env.DB_HOST_MANAGE,
  user: process.env.DB_USER_MANAGE,
  password: process.env.DB_PASS_MANAGE,
  database: process.env.DB_DATABASE_MANAGE,
  port: process.env.DB_PORT_MANAGE
});

function createConnectionPool(config) {
  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: CONNECTION_LIMIT,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: KEEP_ALIVE_DELAY
  });

  pool.on("error", (err) => handlePoolError(err, pool, config));

  return pool;
}

function handlePoolError(err, pool, config) {
  console.error(`MySQL Pool Error (${config.database}):`, err.code);

  const recoverableErrors = ["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "ECONNABORTED"];
  if (recoverableErrors.includes(err.code)) {
    recreatePool(pool, config);
  } else {
    throw err;
  }
}

function recreatePool(pool, config) {
  console.log(`Recreating MySQL Pool for ${config.database}`);
  pool
    .end()
    .then(() => {
      if (config.database === process.env.DB_DATABASE_WEBHOOK) {
        connect_webhook = createConnectionPool(config);
      } else if (config.database === process.env.DB_DATABASE_MANAGE) {
        connect_manage = createConnectionPool(config);
      }
    })
    .catch((err) => {
      console.error("Error recreating MySQL pool:", err);
      setTimeout(() => recreatePool(pool, config), RECREATE_RETRY_DELAY);
    });
}

module.exports = {
  connect_webhook,
  connect_manage
};
