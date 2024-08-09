const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { logger } = require("./logger");
const config = require("./config");

const app = express();

app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

app.use(
  bodyParser.json({
    verify: (req, _, buf) => {
      // @ts-ignore
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
      config.GITHUB_WEBHOOK_SECRET,
      req.headers["x-hub-signature-256"],
      req.body,
    )
  ) {
    logger.warn("Invalid signature");
    return res.status(403).send("Invalid signature");
  }

  const payload = req.body;
  if (payload.ref === `refs/heads/${config.BRANCH_NAME}`) {
    fs.appendFileSync(config.QUEUE_FILE, payload.after + "\n");
    res.status(200).send("Queued");
    logger.info({ event: "queued", hash: payload.after }, "Queued item");
  } else {
    res.status(400).send("Not relevant");
    logger.info({ event: "irrelevant" }, "Received irrelevant webhook event");
  }
});

module.exports = app;
