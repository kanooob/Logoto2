import 'dotenv/config';
import express from 'express';
import { startDiscordBot } from './src/bot/client.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get('/', (_req, res) => {
  res.status(200).send('Bot en ligne');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[Logoto] Keep-alive HTTP server listening on port ${port}`);
  void startDiscordBot();
});
