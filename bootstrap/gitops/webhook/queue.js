const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");
const childProcess = require("node:child_process");
const { logger } = require("./logger");
const config = require("./config");

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

const worker = async (hash) => {
  logger.info({ event: "processing", hash }, "Processing item");

  if (!fs.existsSync("/data/repo")) {
    logger.info({ event: "cloning", hash }, "Repository folder does not exist");
    await exec(`git clone --depth 1 ${config.GITHUB_REPO} repo`, {
      cwd: "/data",
    });
  }

  await exec(`git fetch && git reset --hard origin/${config.BRANCH_NAME}`, {
    cwd: "/data/repo",
  });

  const stacks = await getStacks(path.join("/data/repo", config.STACKS_FOLDER));

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
          IMAGE: image,
        },
      },
    );
  }
};

const processQueue = async () => {
  if (!fs.existsSync(config.QUEUE_FILE)) {
    logger.error("Queue file does not exist");
    return;
  }

  const queue = fs
    .readFileSync(config.QUEUE_FILE, "utf-8")
    .split("\n")
    .filter(Boolean);

  if (queue.length === 0) {
    logger.info({ event: "sleep" }, "No items to process; sleeping.");
    await delay(2000);
    return;
  }

  const hash = queue[0];

  try {
    await worker(hash);
  } finally {
    const newQueue = queue.slice(1).join("\n");
    fs.writeFileSync(config.QUEUE_FILE, newQueue + "\n");
    logger.info({ event: "processed", hash }, "Processed and removed item");
  }
};

module.exports = { processQueue };
