const log4js = require("log4js");
const dateHelper = require("../helpers/dateHelper"); //dateT
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

async function insertLog(req, res, message, logType) {
  const connection = await db.getConnection();
  try {
    const logData = createLogData(req, res, message, logType);
    logMessage(logData);
    await insertLogData(connection, logData);
  } catch (error) {
    console.error("Failed to insert log data:", error);
    throw error;
  } finally {
    connection?.release();
  }
}

// Helper functions
function createLogData(req, res, message, logType) {
  const clientIp = req?.ip || req?.connection?.remoteAddress;
  const ipReplace = normalizeIp(clientIp);

  return {
    ip: ipReplace || null,
    method: req.method || null,
    url: req.originalUrl || null,
    status: res.statusCode || null,
    log_message: message || null,
    log_type: logType || null,
    create_by: req.user || null
  };
}

async function insertLogData(connection, logData) {
  const { ip, method, url, status, log_message, log_type, create_by } = logData;
  const dataLogType = log_type?.split(" - ")[0];
  const dateTime = dateHelper.dateT();
  const method_url = `[${status}][${method}]:${url}`;
  const dataLog = JSON.stringify(log_message);

  const query = `
    INSERT INTO log
    (log_ip, log_method, log_name, log_type, create_date, create_by)
    VALUES (?, ?, ?, ?, ?, ?)`;

  return await connection.execute(query, [ip, method_url, dataLog, dataLogType, dateTime, create_by]);
}

function normalizeIp(ip) {
  if (!ip) return undefined;
  return ip.includes("::ffff:") ? ip.replace("::ffff:", "") : ip.replace("::1", "127.0.0.1");
}

function logMessage(logData) {
  const logMessage = `[status:${logData.status}] ${logData.ip} [${logData.method}]-${logData.url}-[Log type: ${logData.log_type}];`;
  const logMessageError = `[status:${logData.status}] ${logData.ip} [${logData.method}]-${logData.url}-[Log type: ${logData.log_type}]-[message:${logData.log_message}];`;

  if (logData.status == 200 || logData.status == 201) {
    loggerApi.info(logMessage);
  } else {
    loggerApi.error(logMessageError);
  }
}

module.exports = {
  default: loggerDefault,
  api: loggerApi,
  insertLog
};
