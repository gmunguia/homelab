const app = require("./app");
const { processQueue } = require("./queue");
const { logger } = require("./logger");
const config = require("./config");

process.on("uncaughtException", (err) => {
  logger.error({ event: "uncaught-exception", err }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error(
    { event: "unhandled-rejection", err: reason },
    "Unhandled rejection",
  );
  process.exit(1);
});

app.listen(config.PORT, () => {
  logger.info(
    { event: "server-start", port: config.PORT },
    `Server is listening on port ${config.PORT}`,
  );
});

(async () => {
  while (true) {
    await processQueue();
  }
})();
