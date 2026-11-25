import type { Request } from 'express';

export type SiteLocale = 'fr' | 'en';

export interface SiteUrls {
  origin: string;
  home: string;
  dashboard: string;
  docs: string;
  cgu: string;
  privacy: string;
  oauthCallback: string;
}

export function normalizeSiteLocale(input?: string | null): SiteLocale {
  return input?.trim().toLowerCase().startsWith('en') ? 'en' : 'fr';
}

export function normalizeDomainOrigin(raw?: string | null): string {
  const trimmed =
    raw
      ?.trim()
      .replace(/^['"]+|['"]+$/g, '')
      .replace(/\/+$/, '') ?? '';
  if (!trimmed || /[\s\\]/.test(trimmed)) return '';

  const isLocalHost =
    /^https?:\/\//i.test(trimmed) ||
    /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(trimmed);

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${isLocalHost ? 'http' : 'https'}://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    if (parsed.username || parsed.password) {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

export function getExplicitDomainOrigin(): string {
  return normalizeDomainOrigin(process.env.DOMAIN);
}

export function getConfiguredSiteOrigin(): string {
  const candidates = [
    process.env.DOMAIN,
    process.env.APP_URL,
    process.env.WEBSITE_URL,
    process.env.SITE_URL,
  ];
  for (const raw of candidates) {
    const origin = normalizeDomainOrigin(raw);
    if (origin) return origin;
  }
  return '';
}

function getHeaderHostOrigin(req: Request): string {
  const rawHost = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '')
    .split(',')[0]
    .trim();
  if (!rawHost) return '';

  const isLocal = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(rawHost);
  const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  let proto: 'http' | 'https';
  if (forwardedProto === 'https' || forwardedProto === 'http') {
    proto = forwardedProto;
  } else if (isLocal) {
    proto = req.protocol === 'https' ? 'https' : 'http';
  } else {
    proto = 'https';
  }

  return normalizeDomainOrigin(`${proto}://${rawHost}`);
}

function isTrustedDynamicOrigin(candidateOrigin: string, req: Request): boolean {
  if (!candidateOrigin) return false;
  try {
    const parsed = new URL(candidateOrigin);
    const appUrlOrigin = normalizeDomainOrigin(process.env.APP_URL);
    if (appUrlOrigin && parsed.origin === appUrlOrigin) return true;

    const headerHostOrigin = getHeaderHostOrigin(req);
    if (headerHostOrigin && parsed.origin === headerHostOrigin) return true;

    // Allow AI Studio preview & shared containers (.run.app) over HTTPS
    if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.run.app')) {
      return true;
    }

    // Allow localhost in development
    if (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function getSiteOriginFromRequest(req?: Request): string {
  const explicitDomain = getExplicitDomainOrigin();
  if (explicitDomain) return explicitDomain;

  if (req) {
    const queryOriginRaw =
      typeof req.query?.origin === 'string' ? req.query.origin : undefined;
    const queryOrigin = normalizeDomainOrigin(queryOriginRaw);
    if (queryOrigin && isTrustedDynamicOrigin(queryOrigin, req)) {
      return queryOrigin;
    }

    const headerOriginRaw =
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const headerOrigin = normalizeDomainOrigin(headerOriginRaw);
    if (headerOrigin && isTrustedDynamicOrigin(headerOrigin, req)) {
      return headerOrigin;
    }
  }

  const configured = getConfiguredSiteOrigin();
  if (configured) return configured;

  if (!req) return '';
  return getHeaderHostOrigin(req) || 'http://localhost:3000';
}

export function buildSiteUrls(origin: string, locale: SiteLocale = 'fr'): SiteUrls {
  const safeOrigin = origin ? normalizeDomainOrigin(origin) : '';
  const safeLocale: SiteLocale = locale === 'en' ? 'en' : 'fr';
  const prefix = safeOrigin;

  return {
    origin: safeOrigin,
    home: `${prefix}/${safeLocale}`,
    dashboard: `${prefix}/${safeLocale}/dashboard`,
    docs: `${prefix}/${safeLocale}/docs`,
    cgu: `${prefix}/${safeLocale}/cgu`,
    privacy: `${prefix}/${safeLocale}/privacy`,
    oauthCallback: `${prefix}/auth/callback`,
  };
}
