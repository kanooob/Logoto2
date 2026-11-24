import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import type { Client } from 'discord.js';
import express from 'express';
import { startDiscordBot } from './src/bot/client.js';
import {
  botStartedAtUnix,
  drainScheduler,
  stopScheduler,
} from './src/bot/services/schedulerService.js';
import { registerDiscordAuthRoutes } from './src/server/auth.js';
import { registerDashboardRoutes } from './src/server/dashboardRoutes.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST?.trim() || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

let discordClient: Client | null = null;
let shuttingDown = false;

app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ready = Boolean(discordClient?.isReady());
  res.status(ready ? 200 : 503).json({
    status: ready ? 'online' : 'offline',
    discordReady: ready,
  });
});

app.get('/api/stats', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ready = Boolean(discordClient?.isReady());
  const guildCount = ready && discordClient ? discordClient.guilds.cache.size : null;
  const clientId =
    process.env.CLIENT_ID?.trim() || discordClient?.user?.id || '1431383390162124920';

  res.status(200).json({
    server: guildCount !== null ? String(guildCount) : 'fallback',
    guildCount,
    online: ready,
    clientId,
    startedAtUnix: botStartedAtUnix,
  });
});

app.get('/api/status', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ready = Boolean(discordClient?.isReady());
  const pingMs =
    ready && discordClient ? Math.max(0, Math.round(discordClient.ws.ping)) : null;

  res.status(200).json({
    success: true,
    discordReady: ready,
    services: [
      {
        name: 'Logoto Bot',
        status: ready ? 'operational' : 'offline',
        latencyMs: pingMs,
        startedAtUnix: botStartedAtUnix,
      },
    ],
    cachedAt: new Date().toISOString(),
  });
});

registerDiscordAuthRoutes(app, () => discordClient);
registerDashboardRoutes(app, () => discordClient);

async function setupFrontend(): Promise<void> {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    return;
  }

  const distDir = path.resolve(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  app.use(express.static(distDir, { index: false }));

  app.get('*', (_req, res) => {
    if (fs.existsSync(indexHtmlPath)) {
      res.sendFile(indexHtmlPath);
      return;
    }
    res.status(200).send(discordClient?.isReady() ? 'Bot en ligne' : 'Serveur HTTP en ligne');
  });
}

async function bootstrap(): Promise<void> {
  await setupFrontend();

  const server = app.listen(port, host, () => {
    console.log(`[Logoto] Web & keep-alive HTTP server listening on ${host}:${port}`);
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
}

void bootstrap();
