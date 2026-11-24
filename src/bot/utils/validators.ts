import { isIP } from 'node:net';
import {
  EmbedBuilder,
  GuildPremiumTier,
  PermissionsBitField,
  type Guild,
  type GuildMember,
  type PermissionsBitField as PermissionsType,
} from 'discord.js';
import { t, type TranslationKey } from '../i18n/index.js';
import {
  findLogChannel,
  findLogotoCategory,
  normalizeTimeZone,
  parseUtcOffsetMinutes,
} from '../services/guildConfigService.js';
import type { EventType, SupportedLocale } from '../types.js';

const RESERVED_HOST_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
  '.arpa',
  '.lan',
  '.home',
  '.corp',
  '.localdomain',
  '.test',
  '.example',
  '.invalid',
];

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // Link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function isPrivateOrReservedIpv6(rawIp: string): boolean {
  const zoneIdx = rawIp.indexOf('%');
  const ip = (zoneIdx !== -1 ? rawIp.slice(0, zoneIdx) : rawIp).toLowerCase();

  if (ip === '::' || ip === '::1') return true;

  // Handle IPv4-mapped / IPv4-compatible IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  const v4MappedPrefix = '::ffff:';
  if (ip.startsWith(v4MappedPrefix)) {
    const rest = ip.slice(v4MappedPrefix.length);
    if (rest.includes('.')) {
      return isPrivateOrReservedIpv4(rest);
    }
    const hexParts = rest.split(':');
    if (hexParts.length === 2) {
      const hi = Number.parseInt(hexParts[0], 16);
      const lo = Number.parseInt(hexParts[1], 16);
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateOrReservedIpv4(ipv4);
      }
    }
    return true;
  }

  // Expand compressed :: notation to inspect leading hextets
  const halves = ip.split('::');
  if (halves.length > 2) return true;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - (left.length + right.length);
  if (missing < 0) return true;
  const hextets = [...left, ...Array<string>(missing).fill('0'), ...right];
  if (hextets.length !== 8) return true;

  const nums = hextets.map((h) => Number.parseInt(h, 16));
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 0xffff)) return true;

  const first = nums[0];
  const second = nums[1];
  const allZeroExceptLast = nums.slice(0, 7).every((n) => n === 0);
  if (allZeroExceptLast && (nums[7] === 0 || nums[7] === 1)) return true; // :: / ::1
  if ((first & 0xfe00) === 0xfc00) return true; // ULA fc00::/7 (includes fd00::/8)
  if ((first & 0xffc0) === 0xfe80) return true; // Link-local fe80::/10
  if ((first & 0xffc0) === 0xfec0) return true; // Deprecated site-local fec0::/10
  if ((first & 0xff00) === 0xff00) return true; // Multicast ff00::/8
  if (first === 0x0100 && second === 0) return true; // Discard 100::/64
  if (first === 0x2001 && second === 0x0db8) return true; // Documentation 2001:db8::/32
  if (first === 0x2002) return true; // 6to4 relay (can embed private IPv4)

  return false;
}

export function isSafeImageUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 1000) return false;
  if (/[\s\\]/.test(trimmed)) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;

  const rawHost = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (!rawHost) return false;

  const unwrappedHost =
    rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;

  const ipVersion = isIP(unwrappedHost);
  if (ipVersion === 4) {
    return !isPrivateOrReservedIpv4(unwrappedHost);
  }
  if (ipVersion === 6) {
    return !isPrivateOrReservedIpv6(unwrappedHost);
  }

  if (
    unwrappedHost === 'localhost' ||
    RESERVED_HOST_SUFFIXES.some((suffix) => unwrappedHost.endsWith(suffix))
  ) {
    return false;
  }

  // Must be a multi-label public domain name (blocks bare single-label names and raw hex/int hosts)
  if (!unwrappedHost.includes('.')) return false;

  const labels = unwrappedHost.split('.');
  if (labels.some((label) => !label || label.length > 63)) return false;
  const tld = labels[labels.length - 1];
  // Reject numeric/hex TLDs (e.g. 0x7f000001 or octal tricks)
  if (/^\d+$/.test(tld) || /^0x[0-9a-f]+$/i.test(tld)) return false;

  return true;
}

export function isValidServerName(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
}

export function getMaxDaysInMonth(month: number): number {
  switch (Math.trunc(month)) {
    case 2:
      return 29;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

export function isValidDayForMonth(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= getMaxDaysInMonth(month);
}

export function parseValidDay(raw: string, month?: number): number | null {
  const trimmed = raw.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < 1 || num > 31) return null;
  if (month !== undefined && !isValidDayForMonth(num, month)) return null;
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

const REQUIRED_BOT_PERMISSIONS: ReadonlyArray<{ flag: bigint; labelKey: TranslationKey }> = [
  { flag: PermissionsBitField.Flags.ManageGuild, labelKey: 'permManageGuild' },
  { flag: PermissionsBitField.Flags.ManageChannels, labelKey: 'permManageChannels' },
  { flag: PermissionsBitField.Flags.ViewChannel, labelKey: 'permViewChannel' },
  { flag: PermissionsBitField.Flags.SendMessages, labelKey: 'permSendMessages' },
  { flag: PermissionsBitField.Flags.EmbedLinks, labelKey: 'permEmbedLinks' },
];

export async function checkBotGuildPermissions(
  guild: Guild,
  locale: SupportedLocale
): Promise<{ ok: true } | { ok: false; embed: EmbedBuilder }> {
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) {
    return {
      ok: false,
      embed: new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(t(locale, 'botMissingPermsTitle'))
        .setDescription(t(locale, 'botMissingMember')),
    };
  }

  const missingLines: string[] = [];
  const missingFlagSet = new Set<bigint>();

  for (const perm of REQUIRED_BOT_PERMISSIONS) {
    if (!me.permissions.has(perm.flag)) {
      missingLines.push(`• ${t(locale, perm.labelKey)} — *${t(locale, 'permScopeServer')}*`);
      missingFlagSet.add(perm.flag);
    }
  }

  const category = findLogotoCategory(guild);
  const logChannel = findLogChannel(guild, category);
  let targetMention = '`Logoto` / `log-logoto`';

  if (category) {
    const catPerms = category.permissionsFor(me);
    for (const perm of REQUIRED_BOT_PERMISSIONS) {
      if (perm.flag === PermissionsBitField.Flags.ManageGuild) continue;
      if (!catPerms?.has(perm.flag) && !missingFlagSet.has(perm.flag)) {
        missingLines.push(`• ${t(locale, perm.labelKey)} — **\`${category.name}\`**`);
      }
    }
  }

  if (logChannel) {
    targetMention = `<#${logChannel.id}>`;
    const chPerms = logChannel.permissionsFor(me);
    for (const perm of REQUIRED_BOT_PERMISSIONS) {
      if (perm.flag === PermissionsBitField.Flags.ManageGuild) continue;
      if (!chPerms?.has(perm.flag)) {
        missingLines.push(`• ${t(locale, perm.labelKey)} — <#${logChannel.id}>`);
      }
    }
  }

  if (missingLines.length === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    embed: new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(t(locale, 'botMissingPermsTitle'))
      .setDescription(
        t(locale, 'botMissingPermsDesc', {
          missing: missingLines.join('\n'),
          channel: targetMention,
        })
      )
      .setTimestamp(),
  };
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

export function formatLocalDateDisplay(
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
    }).format(shifted);
  }

  try {
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: normalized,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}

export function truncateValue(value: string, max = 60): string {
  const cleaned = value.trim();
  if (!cleaned) return '—';
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}
