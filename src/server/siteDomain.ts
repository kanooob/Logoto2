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
  const trimmed = raw?.trim().replace(/\/+$/, '') ?? '';
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

export function getSiteOriginFromRequest(req?: Request): string {
  const configured = getConfiguredSiteOrigin();
  if (configured) return configured;

  if (!req) return '';

  const rawProto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'http')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const proto = rawProto === 'https' ? 'https' : 'http';

  const rawHost = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? 'localhost:3000')
    .split(',')[0]
    .trim();

  return normalizeDomainOrigin(`${proto}://${rawHost}`);
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
