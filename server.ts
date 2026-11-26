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
import { getSiteOriginFromRequest } from './src/server/siteDomain.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST?.trim() || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

let discordClient: Client | null = null;
let shuttingDown = false;

const TELEMETRY_ONLINE_CACHE_MS = 60_000;
const TELEMETRY_OFFLINE_CACHE_MS = 5_000;

interface TelemetrySnapshot {
  ready: boolean;
  guildCount: number | null;
  pingMs: number | null;
  clientId: string;
  cachedAtIso: string;
  expiresAt: number;
}

let telemetryCache: TelemetrySnapshot | null = null;

function getCachedTelemetry(): TelemetrySnapshot {
  const now = Date.now();
  const readyNow = Boolean(discordClient?.isReady());

  if (
    telemetryCache &&
    now < telemetryCache.expiresAt &&
    telemetryCache.ready === readyNow
  ) {
    return telemetryCache;
  }

  const guildCount =
    readyNow && discordClient ? discordClient.guilds.cache.size : null;
  const pingMs =
    readyNow && discordClient
      ? Math.max(0, Math.round(discordClient.ws.ping))
      : null;
  const clientId =
    process.env.CLIENT_ID?.trim() ||
    discordClient?.user?.id ||
    '1431383390162124920';

  telemetryCache = {
    ready: readyNow,
    guildCount,
    pingMs,
    clientId,
    cachedAtIso: new Date(now).toISOString(),
    expiresAt: now + (readyNow ? TELEMETRY_ONLINE_CACHE_MS : TELEMETRY_OFFLINE_CACHE_MS),
  };

  return telemetryCache;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ready = Boolean(discordClient?.isReady());
  res.status(ready ? 200 : 503).json({
    status: ready ? 'online' : 'offline',
    discordReady: ready,
  });
});

app.get('/api/stats', (_req, res) => {
  const snap = getCachedTelemetry();
  res.setHeader(
    'Cache-Control',
    snap.ready ? 'public, max-age=60, stale-while-revalidate=30' : 'public, max-age=5'
  );

  res.status(200).json({
    server: snap.guildCount !== null ? String(snap.guildCount) : 'fallback',
    guildCount: snap.guildCount,
    online: snap.ready,
    clientId: snap.clientId,
    startedAtUnix: botStartedAtUnix,
    cachedAt: snap.cachedAtIso,
  });
});

app.get('/api/status', (_req, res) => {
  const snap = getCachedTelemetry();
  res.setHeader(
    'Cache-Control',
    snap.ready ? 'public, max-age=60, stale-while-revalidate=30' : 'public, max-age=5'
  );

  res.status(200).json({
    success: true,
    discordReady: snap.ready,
    services: [
      {
        name: 'Logoto Bot',
        status: snap.ready ? 'operational' : 'offline',
        latencyMs: snap.pingMs,
        startedAtUnix: botStartedAtUnix,
      },
    ],
    cachedAt: snap.cachedAtIso,
  });
});

app.get('/robots.txt', (req, res) => {
  const origin = getSiteOriginFromRequest(req);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /auth/',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n')
  );
});

app.get('/sitemap.xml', (req, res) => {
  const origin = getSiteOriginFromRequest(req);
  const lastmod = new Date().toISOString().slice(0, 10);

  const routePairs: Array<{ fr: string; en: string; changefreq: string; priority: string }> = [
    { fr: '/fr', en: '/en', changefreq: 'weekly', priority: '1.0' },
    { fr: '/fr/docs', en: '/en/docs', changefreq: 'weekly', priority: '0.8' },
    { fr: '/fr/dashboard', en: '/en/dashboard', changefreq: 'weekly', priority: '0.7' },
    { fr: '/fr/cgu', en: '/en/cgu', changefreq: 'monthly', priority: '0.4' },
    { fr: '/fr/privacy', en: '/en/privacy', changefreq: 'monthly', priority: '0.4' },
  ];

  const urlsXml: string[] = [
    `  <url>\n` +
      `    <loc>${escapeXml(`${origin}/`)}</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>weekly</changefreq>\n` +
      `    <priority>1.0</priority>\n` +
      `  </url>`,
  ];

  for (const pair of routePairs) {
    const frUrl = escapeXml(`${origin}${pair.fr}`);
    const enUrl = escapeXml(`${origin}${pair.en}`);
    const alternates =
      `    <xhtml:link rel="alternate" hreflang="fr" href="${frUrl}" />\n` +
      `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />`;

    urlsXml.push(
      `  <url>\n` +
        `    <loc>${frUrl}</loc>\n` +
        `${alternates}\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>${pair.changefreq}</changefreq>\n` +
        `    <priority>${pair.priority}</priority>\n` +
        `  </url>`,
      `  <url>\n` +
        `    <loc>${enUrl}</loc>\n` +
        `${alternates}\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>${pair.changefreq}</changefreq>\n` +
        `    <priority>${pair.priority}</priority>\n` +
        `  </url>`
    );
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${urlsXml.join('\n')}\n` +
    `</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(xml);
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
