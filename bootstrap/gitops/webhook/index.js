const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan'); // for HTTP request logging
const pino = require('pino'); // for structured logging

const app = express();
const PORT = process.env.PORT || 3000;
const QUEUE_FILE = '/data/queue';
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

// Ensure the queue file exists
if (!fs.existsSync(QUEUE_FILE)) {
  fs.writeFileSync(QUEUE_FILE, '');
}

// Set up Pino logger
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: true,
      ignore: 'pid,hostname'
    }
  }
});

// Middleware to parse JSON bodies and log HTTP requests
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Use raw body parser to validate signature
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// Function to verify the GitHub webhook signature
const verifySignature = (req) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !GITHUB_WEBHOOK_SECRET) {
    return false;
  }
  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  hmac.update(req.rawBody);
  const digest = `sha256=${hmac.digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
};

// Function to handle webhook requests
app.post('/webhook', (req, res) => {
  if (!verifySignature(req)) {
    logger.warn('Invalid signature');
    return res.status(403).send('Invalid signature');
  }

  const payload = req.body;
  if (payload.ref === 'refs/heads/main') {
    fs.appendFileSync(QUEUE_FILE, payload.after + '\n');
    res.status(200).send('Queued');
    logger.info({ event: 'queued', after: payload.after }, 'Queued item');
  } else {
    res.status(400).send('Not relevant');
    logger.info({ event: 'irrelevant' }, 'Received irrelevant webhook event');
  }
});

// Function to process queue items
const worker = async (item) => {
  logger.info({ event: 'processing', item }, 'Processing item');
  // Simulate async work with a timeout
  return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
};

// Function to read and process queue
const processQueue = async () => {
  if (!fs.existsSync(QUEUE_FILE)) {
    return;
  }

  const queue = fs.readFileSync(QUEUE_FILE, 'utf-8').split('\n').filter(Boolean);

  if (queue.length === 0) {
    setTimeout(processQueue, 5000); // Delay for 5 seconds if queue is empty
    return;
  }

  const item = queue[0];

  try {
    const success = await worker(item);
    if (success) {
      const newQueue = queue.slice(1).join('\n');
      fs.writeFileSync(QUEUE_FILE, newQueue + '\n');
      logger.info({ event: 'processed', item }, 'Processed and removed item');
    }
  } catch (error) {
    logger.error({ event: 'error', item, error }, 'Failed to process item');
  }

  // Process the next item in the queue
  processQueue();
};

// Start processing the queue on startup
processQueue().catch(error => logger.error({ event: 'startup-error', error }, 'Error processing queue on startup'));

// Start the Express server
app.listen(PORT, () => {
  logger.info({ event: 'server-start', port: PORT }, `Server is listening on port ${PORT}`);
});

// Log uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error) => {
  logger.error({ event: 'uncaught-exception', error }, 'Uncaught exception');
  process.exit(1); // optional: exit the process after logging
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ event: 'unhandled-rejection', reason, promise }, 'Unhandled rejection');
  process.exit(1); // optional: exit the process after logging
});
