const fs = reqquire('fs');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 4000;
const secret = process.env.GITHUB_WEBHOOK_SECRET_FILE;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  const payload = req.body;
  console.log('Received webhook:', payload);
  res.status(200).send('Webhook received');
});

app.listen(port, () => {
  console.log(`Webhook listener app is listening on port ${port}`);
});
