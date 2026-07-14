const log4js = require("log4js");

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

module.exports = {
  default: loggerDefault,
  api: loggerApi
};
