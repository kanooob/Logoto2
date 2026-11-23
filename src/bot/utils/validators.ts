import {
  GuildPremiumTier,
  PermissionsBitField,
  type Guild,
  type GuildMember,
  type PermissionsBitField as PermissionsType,
} from 'discord.js';
import { t } from '../i18n/index.js';
import { normalizeTimeZone, parseUtcOffsetMinutes } from '../services/guildConfigService.js';
import type { EventType, SupportedLocale } from '../types.js';

const PRIVATE_IPV4_REGEX = /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

export function isSafeImageUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 1000) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    PRIVATE_IPV4_REGEX.test(host)
  ) {
    return false;
  }

  return true;
}

export function isValidServerName(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
}

export function parseValidDay(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < 1 || num > 31) return null;
  return num;
}

export function getBoostRequirementWarning(
  guild: Guild,
  type: EventType | undefined,
  locale: SupportedLocale
): string | null {
  if (!type) return null;

  if (type === 'b') {
    const hasBanner = guild.features.includes('BANNER') || guild.premiumTier >= GuildPremiumTier.Tier2;
    if (!hasBanner) {
      return t(locale, 'boostWarningBanner', { tier: guild.premiumTier });
    }
  }

  if (type === 'i') {
    const hasSplash =
      guild.features.includes('INVITE_SPLASH') || guild.premiumTier >= GuildPremiumTier.Tier1;
    if (!hasSplash) {
      return t(locale, 'boostWarningSplash', { tier: guild.premiumTier });
    }
  }

  return null;
}

export function normalizeExternalUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^["']|["']$/g, '').trim();
  if (!cleaned) return null;
  const withScheme = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function hasGuildAdminPermission(
  guild: Guild | null,
  userId: string,
  memberPermissions: Readonly<PermissionsType> | null | undefined,
  member?: GuildMember | null
): boolean {
  if (!guild) return false;
  if (guild.ownerId === userId) return true;

  const perms = memberPermissions ?? member?.permissions;
  if (!perms) return false;

  return (
    perms.has(PermissionsBitField.Flags.Administrator) ||
    perms.has(PermissionsBitField.Flags.ManageGuild)
  );
}

export function formatLocalDateTimeDisplay(
  timezone: string,
  locale: SupportedLocale,
  date: Date = new Date()
): string {
  const intlLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const normalized = normalizeTimeZone(timezone) ?? 'UTC';
  const offsetMinutes = parseUtcOffsetMinutes(normalized);

  if (offsetMinutes !== null) {
    const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(shifted);
  }

  try {
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: normalized,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
}

export function truncateValue(value: string, max = 60): string {
  const cleaned = value.trim();
  if (!cleaned) return '—';
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}
