const assert = require("node:assert");
const { promisify } = require("node:util");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const { describe, it, before, after } = require("node:test");

const configStub = {
  BRANCH_NAME: "main",
  GITHUB_WEBHOOK_SECRET: "test_secret",
  QUEUE_FILE: "./test_queue",
  GITHUB_REPO: "https://github.com/gmunguia/homelab.git",
  STACKS_FOLDER: "bootstrap/gitops/webhook/test/stacks",
  IMAGE_REGISTRY_URL: "127.0.0.1:5000",
  PORT: "4000",
  LOG_LEVEL: "debug",
};

const { makeQueue } = require("../queue");
const queue = makeQueue(configStub);

const exec = promisify(childProcess.exec);

describe("Worker", () => {
  before(async () => {
    fs.writeFileSync(configStub.QUEUE_FILE, "");
    queue.enqueue("0000000001");
    await exec("docker swarm init");
  });

  after(async () => {
    fs.unlinkSync(configStub.QUEUE_FILE);
    // await exec("docker swarm leave --force");
  });

  it("given a queue message, it should clone a repo and deploy its stacks", async () => {
    await queue.processQueue();

    const { stdout } = await exec("docker service ls --format '{{.Name}}'");
    assert.match(stdout, /hello-world_hello/);
    assert.match(stdout, /bye-world_bye/);
  });
});
