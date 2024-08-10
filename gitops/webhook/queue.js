const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");
const childProcess = require("node:child_process");
const { logger } = require("./logger");
const _config = require("./config");

const EMPTY_QUEUE = Symbol("EMPTY_QUEUE");

const delay = async (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

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
  // @ts-ignore
  const { stdout, stderr } = await _exec(...args);
  logger.debug({ event: "exec", stdout, stderr }, "exec shell command");
  return { stdout, stderr };
};

const makeQueue = (config = _config) => {
  const worker = async (hash) => {
    logger.info({ event: "processing", hash }, "Processing message");

    if (!fs.existsSync("/data/repo")) {
      logger.info(
        { event: "cloning", hash },
        "Repository folder does not exist",
      );
      await exec(`git clone --depth 1 ${config.GITHUB_REPO} repo`, {
        cwd: "/data",
      });
    }

    const stacks = await getStacks(
      path.join("/data/repo", config.STACKS_FOLDER),
    );

    for (const { name, path } of stacks) {
      const image = `${config.IMAGE_REGISTRY_URL}/${name}:${hash}`;
      await exec(`docker build --pull --tag ${image} .`, { cwd: path });
      await exec(`docker push ${image}`, {
        cwd: path,
      });
      await exec(
        `docker stack deploy --prune --compose-file docker-compose.yml ${name}`,
        {
          cwd: path,
          env: {
            ...process.env,
            IMAGE: image,
          },
        },
      );
    }
  };

  const processQueue = async () => {
    const hash = dequeue();

    if (hash === EMPTY_QUEUE) {
      logger.info({ event: "empty-queue" }, "Queue is empty. Waiting.");
      await delay(2_000);
      return;
    }

    try {
      await worker(hash);
      logger.info({ event: "worker-succeeded", hash }, "Processed message");
    } catch (err) {
      logger.error(
        { event: "worker-failed", hash, err },
        "Failed processing message",
      );
    }
  };

  const enqueue = (message) => {
    fs.appendFileSync(config.QUEUE_FILE, message + "\n");
  };

  const dequeue = () => {
    if (!fs.existsSync(config.QUEUE_FILE)) {
      logger.error("Queue file does not exist");
      return;
    }

    const messages = fs
      .readFileSync(config.QUEUE_FILE, "utf-8")
      .split("\n")
      .filter(Boolean);

    if (messages.length === 0) {
      return EMPTY_QUEUE;
    }

    const newQueue = messages.slice(1).join("\n");
    fs.writeFileSync(config.QUEUE_FILE, newQueue + "\n");

    return messages[0];
  };

  return { dequeue, enqueue, processQueue };
};

module.exports.makeQueue = makeQueue;
