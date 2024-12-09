const log4js = require("log4js");
const dateHelper = require("../helpers/dateHelper");
const db = require("../services/connectionService");

log4js.configure({
  appenders: {
    file: {
      type: "file",
      filename: "logs/app.log",
      layout: {
        type: "pattern",
        pattern: "[%d] [%p] %c %X{ip}|[%X{method}] URL:%X{url} %m"
      }
    },
    console: { type: "console" },
    api: {
      type: "stdout",
      layout: {
        type: "pattern",
        pattern: "%d{ISO8601} %[[%p]%] %m"
        // pattern: "[%d] %[[%p]%] %c %X{ip}|[%X{method}] URL:%X{url} %m"
      }
    }
  },
  categories: {
    default: { appenders: ["file"], level: "debug", enableCallStack: true },
    api: { appenders: ["api"], level: "debug" }
  }
});

const loggerDefault = log4js.getLogger();
const loggerApi = log4js.getLogger("api");

/**
 * Inserts a log entry into the database and logs the message to the appropriate logger.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} message - The log message.
 * @param {string} logType - The log type.
 */
async function insertLog(req, res, message, logType) {
  const connection = await db.getConnection();
  try {
    const logData = createLogData(req, res, message, logType);
    logToConsole(logData);
    await saveLogToDatabase(connection, logData);
  } catch (error) {
    console.error("Failed to insert log data:", error);
    throw error;
  } finally {
    connection?.release();
  }
}

/**
 * Creates the log data object.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} message - The log message.
 * @param {string} logType - The log type.
 * @returns {Object} The log data object.
 */
function createLogData(req, res, message, logType) {
  const clientIp = req?.ip || req?.connection?.remoteAddress;
  const normalizedIp = normalizeIp(clientIp);

  return {
    ip: normalizedIp || null,
    method: req.method || null,
    url: req.originalUrl || null,
    status: res.statusCode || null,
    log_message: message || null,
    log_type: logType || null
  };
}

/**
 * Saves log data to the database.
 * @param {Object} connection - The database connection.
 * @param {Object} logData - The log data object.
 */
async function saveLogToDatabase(connection, logData) {
  const { ip, method, url, status, log_message, log_type } = logData;
  const logTypeName = log_type?.split(" - ")[0];
  const dateTime = dateHelper.dateT();
  const methodUrl = `[${status}][${method}]:${url}`;
  const logMessage = JSON.stringify(log_message);

  const query = `INSERT INTO log (log_ip, log_method, log_name, log_type, log_date) VALUES (?, ?, ?, ?, ?)`;
  await connection.execute(query, [ip, methodUrl, logMessage, logTypeName, dateTime]);
}

/**
 * Normalizes an IP address by removing unnecessary prefixes.
 * @param {string} ip - The IP address.
 * @returns {string} The normalized IP address.
 */
function normalizeIp(ip) {
  if (!ip) return undefined;
  return ip.includes("::ffff:") ? ip.replace("::ffff:", "") : ip.replace("::1", "127.0.0.1");
}

/**
 * Logs the message to the appropriate logger.
 * @param {Object} logData - The log data object.
 */
function logToConsole(logData) {
  const logMessage = `[status:${logData.status}] ${logData.ip} [${logData.method}]-${logData.url}-[Log type: ${logData.log_type}];`;
  const logErrorMessage = `${logMessage}-[message:${logData.log_message}];`;

  if (logData.status === 200 || logData.status === 201) {
    loggerApi.info(logMessage);
  } else {
    loggerApi.error(logErrorMessage);
  }
}

module.exports = {
  default: loggerDefault,
  api: loggerApi,
  insertLog
};
