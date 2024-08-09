const fs = require("node:fs");

module.exports = {
  BRANCH_NAME: process.env.BRANCH_NAME,
  GITHUB_REPO: process.env.GITHUB_REPO,
  GITHUB_WEBHOOK_SECRET_FILE: process.env.GITHUB_WEBHOOK_SECRET_FILE,
  IMAGE_REGISTRY_URL: process.env.IMAGE_REGISTRY_URL,
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  PORT: process.env.PORT,
  QUEUE_FILE: "/data/queue",
  STACKS_FOLDER: process.env.STACKS_FOLDER,
  GITHUB_WEBHOOK_SECRET: fs.readFileSync(
    process.env.GITHUB_WEBHOOK_SECRET_FILE,
    "utf-8",
  ),
};
