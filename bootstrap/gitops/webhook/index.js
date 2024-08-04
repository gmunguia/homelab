const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const pino = require("pino");

const app = express();
const PORT = process.env.PORT || 3000;
const QUEUE_FILE = "/data/queue";
const GITHUB_WEBHOOK_SECRET_FILE = process.env.GITHUB_WEBHOOK_SECRET_FILE;

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      translateTime: true,
      ignore: "pid,hostname",
    },
  },
});

process.on("uncaughtException", (error) => {
  logger.error({ event: "uncaught-exception", error }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    { event: "unhandled-rejection", reason, promise },
    "Unhandled rejection",
  );
  process.exit(1);
});

const GITHUB_WEBHOOK_SECRET = fs.readFileSync(
  GITHUB_WEBHOOK_SECRET_FILE,
  "utf-8",
);

if (!fs.existsSync(QUEUE_FILE)) {
  fs.writeFileSync(QUEUE_FILE, "");
}

app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

const verifySignature = (req) => {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !GITHUB_WEBHOOK_SECRET) {
    return false;
  }
  const hmac = crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET);
  hmac.update(req.rawBody);
  const digest = `sha256=${hmac.digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
};

app.post("/webhook", (req, res) => {
  if (!verifySignature(req)) {
    logger.warn("Invalid signature");
    return res.status(403).send("Invalid signature");
  }

  const payload = req.body;
  if (payload.ref === "refs/heads/main") {
    fs.appendFileSync(QUEUE_FILE, payload.after + "\n");
    res.status(200).send("Queued");
    logger.info({ event: "queued", after: payload.after }, "Queued item");
  } else {
    res.status(400).send("Not relevant");
    logger.info({ event: "irrelevant" }, "Received irrelevant webhook event");
  }
});

const worker = async (item) => {
  logger.info({ event: "processing", item }, "Processing item");
  // Simulate async work with a timeout
  return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
};

const processQueue = async () => {
  if (!fs.existsSync(QUEUE_FILE)) {
    logger.error("Queue file does not exist");
    return;
  }

  const queue = fs
    .readFileSync(QUEUE_FILE, "utf-8")
    .split("\n")
    .filter(Boolean);

  if (queue.length === 0) {
    const twoSeconds = 2000;
    setTimeout(processQueue, twoSeconds);
    return;
  }

  const item = queue[0];

  try {
    const success = await worker(item);
    if (success) {
      const newQueue = queue.slice(1).join("\n");
      fs.writeFileSync(QUEUE_FILE, newQueue + "\n");
      logger.info({ event: "processed", item }, "Processed and removed item");
    }
  } catch (error) {
    logger.error({ event: "error", item, error }, "Failed to process item");
  }

  processQueue();
};

processQueue();

app.listen(PORT, () => {
  logger.info(
    { event: "server-start", port: PORT },
    `Server is listening on port ${PORT}`,
  );
});
