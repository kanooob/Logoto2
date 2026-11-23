import 'dotenv/config';
import type { Client } from 'discord.js';
import express from 'express';
import { startDiscordBot } from './src/bot/client.js';
import { stopScheduler } from './src/bot/services/schedulerService.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get('/', (_req, res) => {
  res.status(200).send('Bot en ligne');
});

let discordClient: Client | null = null;
let shuttingDown = false;

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[Logoto] Keep-alive HTTP server listening on port ${port}`);
  void startDiscordBot().then((client) => {
    discordClient = client;
  });
});

function gracefulShutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Logoto] Received ${signal}, shutting down gracefully...`);

  stopScheduler();

  try {
    discordClient?.destroy();
  } catch {
    // Ignore destroy errors during shutdown
  }

  const forceExitTimer = setTimeout(() => {
    process.exit(0);
  }, 4000);
  forceExitTimer.unref();

  server.close(() => {
    clearTimeout(forceExitTimer);
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[Logoto] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Logoto] Uncaught exception:', err);
});
