import { PermissionsBitField, type Guild, type GuildMember, type PermissionsBitField as PermissionsType } from 'discord.js';
import type { SupportedLocale } from '../types.js';

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
  try {
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: timezone,
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
