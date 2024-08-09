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

const server = app.listen(config.PORT, () => {
  logger.info(
    { event: "server-start", port: config.PORT },
    `Server is listening on port ${config.PORT}`,
  );
});

const shutdownQueue = (() => {
  let processing;
  let isShuttingDown = false;

  (async () => {
    while (!isShuttingDown) {
      processing = processQueue();
      await processing;
    }
  })();

  return async () => {
    isShuttingDown = true;
    await processing;
  };
})();

const shutdownServer = async () => {
  return new Promise((resolve) => {
    server.close((err) => {
      if (err) {
        logger.error(
          { event: "server-close-error", err },
          "Error closing server",
        );
      }
      resolve();
    });
  });
};

["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) => {
  process.on(signal, async () => {
    logger.info({ event: "shutdown-initiated", signal }, "Shutdown initiated");

    await shutdownServer();
    await shutdownQueue();

    logger.info({ event: "shutdown-complete" }, "Shutdown complete");
    process.exit(0);
  });
});
