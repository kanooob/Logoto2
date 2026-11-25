import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Client } from 'discord.js';
import type { Express, NextFunction, Request, Response } from 'express';
import {
  buildSiteUrls,
  getSiteOriginFromRequest,
  normalizeSiteLocale,
  type SiteLocale,
} from './siteDomain.js';

export interface DiscordUserProfile {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
}

export interface DiscordOAuthGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface DiscordSession {
  id: string;
  user: DiscordUserProfile;
  accessToken: string;
  guilds: DiscordOAuthGuild[];
  guildsFetchedAt: number;
  expiresAt: number;
}

export interface AuthenticatedRequest extends Request {
  discordSession?: DiscordSession;
}

const SESSION_COOKIE_NAME = 'logoto_sid';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_TTL_MS = 60 * 1000;
const GUILD_REFRESH_TTL_MS = 30 * 1000;

const RUNTIME_SESSION_SECRET =
  process.env.SESSION_SECRET?.trim() ||
  process.env.CONFIG_SIGNING_SECRET?.trim() ||
  randomBytes(32).toString('hex');

const pendingStates = new Map<
  string,
  { redirectUri: string; locale: SiteLocale; expiresAt: number }
>();
const pendingExchanges = new Map<string, { sessionId: string; expiresAt: number }>();
const sessions = new Map<string, DiscordSession>();

const ADMIN_BIT = 0x8n;
const MANAGE_GUILD_BIT = 0x20n;

function cleanupExpiredMaps(): void {
  const now = Date.now();
  for (const [k, v] of pendingStates.entries()) {
    if (v.expiresAt <= now) pendingStates.delete(k);
  }
  for (const [k, v] of pendingExchanges.entries()) {
    if (v.expiresAt <= now) pendingExchanges.delete(k);
  }
  for (const [k, v] of sessions.entries()) {
    if (v.expiresAt <= now) sessions.delete(k);
  }
}

setInterval(cleanupExpiredMaps, 60_000).unref();

export function hasManagePermission(guild: DiscordOAuthGuild): boolean {
  if (guild.owner) return true;
  try {
    const perms = BigInt(guild.permissions);
    return (perms & ADMIN_BIT) !== 0n || (perms & MANAGE_GUILD_BIT) !== 0n;
  } catch {
    return false;
  }
}

function signSessionId(sessionId: string): string {
  const sig = createHmac('sha256', RUNTIME_SESSION_SECRET)
    .update(sessionId)
    .digest('base64url');
  return `${sessionId}.${sig}`;
}

function verifySignedToken(token: string): string | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const sessionId = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!sessionId || !sig) return null;

  const expected = createHmac('sha256', RUNTIME_SESSION_SECRET)
    .update(sessionId)
    .digest('base64url');
  const actualBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null;
  return sessionId;
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const key = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function extractSessionFromRequest(req: Request): DiscordSession | null {
  let rawToken: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawToken = authHeader.slice(7).trim();
  }
  if (!rawToken) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME]) {
      rawToken = cookies[SESSION_COOKIE_NAME];
    }
  }
  if (!rawToken) return null;

  const sessionId = verifySignedToken(rawToken);
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(sessionId);
    return null;
  }
  return session;
}

function getAppBaseUrl(req: Request): string {
  return getSiteOriginFromRequest(req);
}

export function getRedirectUri(req: Request): string {
  return buildSiteUrls(getAppBaseUrl(req)).oauthCallback;
}

function setSessionCookie(res: Response, signedToken: string): void {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(signedToken)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${maxAgeSec}`
  );
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );
}

async function fetchDiscordUserAndGuilds(
  accessToken: string
): Promise<{ user: DiscordUserProfile; guilds: DiscordOAuthGuild[] }> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [userRes, guildsRes] = await Promise.all([
    fetch('https://discord.com/api/v10/users/@me', { headers }),
    fetch('https://discord.com/api/v10/users/@me/guilds', { headers }),
  ]);

  if (!userRes.ok) {
    throw new Error(`Discord /users/@me returned ${userRes.status}`);
  }
  if (!guildsRes.ok) {
    throw new Error(`Discord /users/@me/guilds returned ${guildsRes.status}`);
  }

  const rawUser = (await userRes.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };
  const rawGuilds = (await guildsRes.json()) as DiscordOAuthGuild[];

  const avatarUrl = rawUser.avatar
    ? `https://cdn.discordapp.com/avatars/${rawUser.id}/${rawUser.avatar}.png?size=128`
    : null;

  return {
    user: {
      id: rawUser.id,
      username: rawUser.username,
      globalName: rawUser.global_name ?? null,
      avatarUrl,
    },
    guilds: Array.isArray(rawGuilds) ? rawGuilds.filter(hasManagePermission) : [],
  };
}

export async function refreshSessionGuildsIfNeeded(session: DiscordSession): Promise<void> {
  if (Date.now() - session.guildsFetchedAt < GUILD_REFRESH_TTL_MS) return;
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (res.ok) {
      const rawGuilds = (await res.json()) as DiscordOAuthGuild[];
      if (Array.isArray(rawGuilds)) {
        session.guilds = rawGuilds.filter(hasManagePermission);
        session.guildsFetchedAt = Date.now();
      }
    }
  } catch {
    // Keep existing cached guilds if Discord rate-limits
  }
}

export function requireDiscordAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const session = extractSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Authentification Discord requise.' });
    return;
  }

  // CSRF check on mutating routes when using cookie-only auth
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    const hasCustomHeader = req.headers['x-requested-with'] === 'LogotoDashboard';
    if (!hasBearer && !hasCustomHeader) {
      res.status(403).json({ error: 'En-tête de sécurité manquant.' });
      return;
    }
  }

  req.discordSession = session;
  next();
}

export function registerDiscordAuthRoutes(
  app: Express,
  getDiscordClient: () => Client | null
): void {
  app.get('/api/auth/config', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const client = getDiscordClient();
    const clientId = process.env.CLIENT_ID?.trim() || client?.user?.id || '';
    const clientSecret = process.env.CLIENT_SECRET?.trim() || '';
    const oauthConfigured = Boolean(clientId && clientSecret);
    const locale = normalizeSiteLocale(
      typeof req.query.locale === 'string' ? req.query.locale : 'fr'
    );
    const siteOrigin = getAppBaseUrl(req);
    const urls = buildSiteUrls(siteOrigin, locale);

    res.json({
      oauthConfigured,
      botOnline: Boolean(client?.isReady()),
      clientId: clientId || '1431383390162124920',
      siteOrigin,
      urls,
      redirectUri: urls.oauthCallback,
    });
  });

  app.get('/api/auth/discord/url', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const client = getDiscordClient();
    const clientId = process.env.CLIENT_ID?.trim() || client?.user?.id || '';
    const clientSecret = process.env.CLIENT_SECRET?.trim() || '';

    if (!clientId || !clientSecret) {
      res.status(503).json({
        error: 'OAuth Discord non configuré (CLIENT_ID et CLIENT_SECRET requis côté serveur).',
      });
      return;
    }

    const locale = normalizeSiteLocale(
      typeof req.query.locale === 'string' ? req.query.locale : 'fr'
    );
    const redirectUri = getRedirectUri(req);
    const state = randomBytes(24).toString('base64url');
    pendingStates.set(state, {
      redirectUri,
      locale,
      expiresAt: Date.now() + STATE_TTL_MS,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    });

    res.json({
      url: `https://discord.com/oauth2/authorize?${params.toString()}`,
      redirectUri,
    });
  });

  const callbackHandler = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const errorParam = typeof req.query.error === 'string' ? req.query.error : '';

    const pending = state ? pendingStates.get(state) : undefined;
    if (state) pendingStates.delete(state);

    const targetLocale: SiteLocale = pending?.locale ?? 'fr';
    const dashboardUrl = buildSiteUrls(getAppBaseUrl(req), targetLocale).dashboard;
    const safeDashboardUrlJson = JSON.stringify(dashboardUrl).replace(/</g, '\\u003c');

    if (errorParam) {
      res.status(400).send(`<!doctype html><html><body style="background:#36393f;color:#F2F3F5;font-family:sans-serif;padding:32px;"><p>Connexion Discord annulée.</p><script>if(window.opener){window.opener.postMessage({type:'OAUTH_AUTH_ERROR'},'*');window.close();}else{window.location.href=${safeDashboardUrlJson};}</script></body></html>`);
      return;
    }

    if (!code || !pending || pending.expiresAt <= Date.now()) {
      res.status(400).send(`<!doctype html><html><body style="background:#36393f;color:#F2F3F5;font-family:sans-serif;padding:32px;"><p>Session OAuth expirée ou invalide. Veuillez réessayer.</p><script>if(!window.opener){setTimeout(function(){window.location.href=${safeDashboardUrlJson};},1500);}</script></body></html>`);
      return;
    }

    const client = getDiscordClient();
    const clientId = process.env.CLIENT_ID?.trim() || client?.user?.id || '';
    const clientSecret = process.env.CLIENT_SECRET?.trim() || '';

    if (!clientId || !clientSecret) {
      res.status(500).send('Configuration OAuth serveur incomplète.');
      return;
    }

    try {
      const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: pending.redirectUri,
      });

      const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text().catch(() => '');
        console.error('[Logoto OAuth] Token exchange failed:', tokenRes.status, errBody);
        res.status(502).send('Échec de l’échange du code OAuth2 avec Discord.');
        return;
      }

      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        res.status(502).send('Jeton Discord manquant.');
        return;
      }

      const { user, guilds } = await fetchDiscordUserAndGuilds(tokenJson.access_token);
      const sessionId = randomBytes(24).toString('base64url');
      sessions.set(sessionId, {
        id: sessionId,
        user,
        accessToken: tokenJson.access_token,
        guilds,
        guildsFetchedAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS,
      });

      const signedToken = signSessionId(sessionId);
      setSessionCookie(res, signedToken);

      const exchangeCode = randomBytes(20).toString('base64url');
      pendingExchanges.set(exchangeCode, {
        sessionId,
        expiresAt: Date.now() + EXCHANGE_TTL_MS,
      });

      const safeExchangeJson = JSON.stringify(exchangeCode).replace(/</g, '\\u003c');

      res.status(200).send(`<!doctype html>
<html lang="${targetLocale}">
  <head><meta charset="utf-8"><title>Connexion Discord — Logoto</title></head>
  <body style="background:#36393f;color:#F2F3F5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
    <p>Connexion réussie. Redirection en cours…</p>
    <script>
      (function() {
        var exchangeCode = ${safeExchangeJson};
        var dashboardUrl = ${safeDashboardUrlJson};
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', exchangeCode: exchangeCode, redirectTo: dashboardUrl }, '*');
          window.close();
        } else {
          window.location.href = dashboardUrl;
        }
      })();
    </script>
  </body>
</html>`);
    } catch (err) {
      console.error('[Logoto OAuth] Callback error:', err);
      res.status(500).send('Erreur lors de la connexion Discord.');
    }
  };

  app.get(['/auth/callback', '/auth/callback/'], callbackHandler);

  app.post('/api/auth/exchange', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const code = typeof req.body?.exchangeCode === 'string' ? req.body.exchangeCode.trim() : '';
    if (!code) {
      res.status(400).json({ error: 'Code d’échange manquant.' });
      return;
    }

    const entry = pendingExchanges.get(code);
    pendingExchanges.delete(code);
    if (!entry || entry.expiresAt <= Date.now()) {
      res.status(401).json({ error: 'Code d’échange expiré ou invalide.' });
      return;
    }

    const session = sessions.get(entry.sessionId);
    if (!session || session.expiresAt <= Date.now()) {
      res.status(401).json({ error: 'Session expirée.' });
      return;
    }

    const signedToken = signSessionId(session.id);
    setSessionCookie(res, signedToken);
    res.json({
      token: signedToken,
      user: session.user,
    });
  });

  app.get('/api/auth/me', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const session = extractSessionFromRequest(req);
    if (!session) {
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({
      authenticated: true,
      user: session.user,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    const hasCustomHeader = req.headers['x-requested-with'] === 'LogotoDashboard';
    if (!hasBearer && !hasCustomHeader && req.headers.cookie) {
      res.status(403).json({ error: 'En-tête de sécurité manquant.' });
      return;
    }
    const session = extractSessionFromRequest(req);
    if (session) {
      sessions.delete(session.id);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });
}
