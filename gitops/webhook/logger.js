const { pino } = require("pino");
const config = require("./config");

const logger = pino({
  transport: {
    target: "pino-pretty",
    level: config.LOG_LEVEL,
    options: {
      translateTime: true,
      ignore: "pid,hostname",
    },
  },
});

module.exports.logger = logger;
