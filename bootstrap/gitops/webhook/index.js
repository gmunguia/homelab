const { promisify } = require("node:util");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const pino = require("pino");

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

const PORT = process.env.PORT || 4000;
const QUEUE_FILE = "/data/queue";
const GITHUB_WEBHOOK_SECRET_FILE = process.env.GITHUB_WEBHOOK_SECRET_FILE;

const GITHUB_WEBHOOK_SECRET = fs.readFileSync(
  GITHUB_WEBHOOK_SECRET_FILE,
  "utf-8",
);

if (!fs.existsSync(QUEUE_FILE)) {
  fs.writeFileSync(QUEUE_FILE, "");
}

const delay = async (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const app = express();

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

const verifySignature = async (secret, header, payload) => {
  let encoder = new TextEncoder();
  let parts = header.split("=");
  let sigHex = parts[1];

  let algorithm = { name: "HMAC", hash: { name: "SHA-256" } };

  let keyBytes = encoder.encode(secret);
  let extractable = false;
  let key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    algorithm,
    extractable,
    ["sign", "verify"],
  );

  let sigBytes = hexToBytes(sigHex);
  let dataBytes = encoder.encode(payload);
  let equal = await crypto.subtle.verify(
    algorithm.name,
    key,
    sigBytes,
    dataBytes,
  );

  return equal;
};

const hexToBytes = (hex) => {
  let len = hex.length / 2;
  let bytes = new Uint8Array(len);

  let index = 0;
  for (let i = 0; i < hex.length; i += 2) {
    let c = hex.slice(i, i + 2);
    let b = parseInt(c, 16);
    bytes[index] = b;
    index += 1;
  }

  return bytes;
};

app.post("/webhook", (req, res) => {
  if (
    !verifySignature(
      GITHUB_WEBHOOK_SECRET,
      req.headers["x-hub-signature-256"],
      req.body,
    )
  ) {
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

const getStacks = async (baseDir) => {
  const folders = await fsp.readdir(baseDir);

  const stacks = [];
  for (const folder of folders) {
    const folderPath = path.join(baseDir, folder);
    const stats = await fsp.stat(folderPath);

    if (stats.isDirectory()) {
      // TODO check folder contains docker-compose.yml
      stacks.push({ name: folder, path: folderPath });
    }
  }

  return stacks;
};

const _exec = promisify(childProcess.exec);
const exec = async (...args) => {
  const { stdout, stderr } = await _exec(...args);
  logger.debug({ event: "exec", stdout, stderr }, "exec shell command");
  return { stdout, stderr };
};

const worker = async (item) => {
  logger.info({ event: "processing", item }, "Processing item");

  if (!fs.existsSync(QUEUE_FILE)) {
    logger.error("Queue file does not exist");
    return;
  }

  if (!(await fsp.exists("/data/homelab"))) {
    logger.info({ event: "cloning", item }, "Repository folder does not exist");
    await exec(`git clone --depth 1 https://github.com/gmunguia/homelab.git`, {
      cwd: "/data",
    });
  }

  await exec("git pull --ff-only", { cwd: "/data/homelab" });

  const stacks = await getStacks("/data/homelab/stacks");

  for (const { name, path } of stacks) {
    await exec("docker compose build", { cwd: path });
    await exec("docker compose push", { cwd: path });
    await exec(
      `docker stack deploy --prune --compose-file docker-compose.yml ${name}`,
      { cwd: path },
    );
  }
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
    logger.info({ event: "sleep", item }, "No items to process; sleeping.");
    await delay(2000);
    return
  }

  const item = queue[0];

  try {
    await worker(item);
  } finally {
    const newQueue = queue.slice(1).join("\n");
    fs.writeFileSync(QUEUE_FILE, newQueue + "\n");
    logger.info({ event: "processed", item }, "Processed and removed item");
  }
};

// TODO graceful shutdown, timeouts, max retries
(async () => {
  while (true) {
    await processQueue();
  }
})();

app.listen(PORT, () => {
  logger.info(
    { event: "server-start", port: PORT },
    `Server is listening on port ${PORT}`,
  );
});
