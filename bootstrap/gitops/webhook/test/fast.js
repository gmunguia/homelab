const assert = require("node:assert");
const fs = require("node:fs");
const { describe, it, after, beforeEach } = require("node:test");
const crypto = require("node:crypto");
const request = require("supertest");

const configStub = {
  BRANCH_NAME: "main",
  GITHUB_WEBHOOK_SECRET: "test_secret",
  QUEUE_FILE: "./test_queue",
  GITHUB_REPO: "",
  STACKS_FOLDER: "",
  IMAGE_REGISTRY_URL: "",
  PORT: "4000",
  LOG_LEVEL: "debug",
};

const { makeQueue } = require("../queue");
const queue = makeQueue(configStub);

const { makeApp } = require("../app");
const app = makeApp({ config: configStub, queue });

describe("Webhook endpoint", () => {
  beforeEach(() => {
    fs.writeFileSync(configStub.QUEUE_FILE, "");
  });

  after(() => {
    fs.unlinkSync(configStub.QUEUE_FILE);
  });

  const createSignature = (body) => {
    const hmac = crypto.createHmac("sha256", configStub.GITHUB_WEBHOOK_SECRET);
    hmac.update(JSON.stringify(body));
    return `sha256=${hmac.digest("hex")}`;
  };

  it("given a request with an invalid signature, it should return an error", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    after(() => {
      process.env.NODE_ENV = originalEnv;
    });

    const payload = {
      ref: "refs/heads/main",
      after: "1234567890abcdef",
    };

    const invalidSignature = "sha256=invalid_signature";

    const response = await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", invalidSignature)
      .send(payload);

    assert.equal(response.status, 403);
    assert.equal(typeof queue.dequeue(), "symbol");
  });

  it("given a request to a branch other than main, it should return an error", async () => {
    const payload = JSON.stringify({
      ref: "refs/heads/other-branch",
      after: "1234567890abcdef",
    });

    const signature =
      "sha256=ac2343250a238d181f99eae6ff648846464a669b0b9c65005c5780d466cd6113";

    const response = await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signature)
      .send(payload);

    assert.equal(response.status, 422);
    assert.equal(typeof queue.dequeue(), "symbol");
  });

  it("given a valid request, it should enqueue the commit hash", async () => {
    const payload = JSON.stringify({
      ref: "refs/heads/main",
      after: "1234567890abcdef",
    });

    const signature =
      "sha256=fff9d5a16dcfbaadd6e7aeccd1b322aabf17d0ddfad39cf8bb84e1872d6d741d";

    const response = await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signature)
      .send(payload);

    assert.equal(response.status, 202);
    assert.equal(queue.dequeue(), "1234567890abcdef");
  });
});
