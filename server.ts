import 'dotenv/config';
import type { Client } from 'discord.js';
import express from 'express';
import { startDiscordBot } from './src/bot/client.js';
import { drainScheduler, stopScheduler } from './src/bot/services/schedulerService.js';

const app = express();
app.disable('x-powered-by');

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST?.trim() || '0.0.0.0';

let discordClient: Client | null = null;
let shuttingDown = false;

app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (discordClient?.isReady()) {
    res.status(200).send('Bot en ligne');
    return;
  }
  res.status(200).send('Serveur HTTP en ligne (bot Discord hors ligne)');
});

app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ready = Boolean(discordClient?.isReady());
  res.status(ready ? 200 : 503).json({ status: ready ? 'online' : 'offline', discordReady: ready });
});

const server = app.listen(port, host, () => {
  console.log(`[Logoto] Keep-alive HTTP server listening on ${host}:${port}`);
  void startDiscordBot().then((client) => {
    discordClient = client;
  });
});

server.on('error', (err) => {
  console.error(`[Logoto] HTTP server error on ${host}:${port}:`, err);
  process.exit(1);
});

async function gracefulShutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Logoto] Received ${signal}, shutting down gracefully...`);

  stopScheduler();

  const forceExitTimer = setTimeout(() => {
    process.exit(exitCode);
  }, 5000);
  forceExitTimer.unref();

  try {
    await drainScheduler(3000);
  } catch {
    // Ignore scheduler drain timeout during shutdown
  }

  try {
    await discordClient?.destroy();
  } catch {
    // Ignore destroy errors during shutdown
  }

  server.close(() => {
    clearTimeout(forceExitTimer);
    process.exit(exitCode);
  });
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM', 0);
});
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT', 0);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Logoto] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Logoto] Uncaught exception:', err);
  void gracefulShutdown('uncaughtException', 1);
});
