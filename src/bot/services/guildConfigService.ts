import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ChannelType,
  PermissionsBitField,
  type CategoryChannel,
  type EmbedBuilder,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { normalizeLocale } from '../i18n/index.js';
import type { GuildConfig, LocalDateParts, SupportedLocale } from '../types.js';

export const CATEGORY_NAME = 'Logoto';
export const LOG_CHANNEL_NAME = 'log-logoto';
export const DEFAULT_TIMEZONE = 'UTC';
export const DEFAULT_LOCALE: SupportedLocale = 'en';

const UTC_OFFSET_REGEX = /^(?:(?:utc|gmt)\s*)?([+-])\s*(\d{1,2})(?::(\d{2}))?$/i;
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface VerifiedGuildState {
  categoryId?: string;
  logChannelId?: string;
  timezone: string;
  locale: SupportedLocale;
  lastRunDate?: string;
  signed: boolean;
}

const verifiedGuildCache = new Map<string, VerifiedGuildState>();

function getSigningSecret(): string | null {
  return process.env.CONFIG_SIGNING_SECRET?.trim() || process.env.TOKEN?.trim() || null;
}

function computeTopicSignature(
  guildId: string,
  timezone: string,
  locale: SupportedLocale,
  lastRunDate?: string
): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const payload = `${guildId}|${timezone}|${locale}|${lastRunDate ?? ''}`;
  return createHmac('sha256', secret).update(payload).digest('base64url').slice(0, 16);
}

function verifyTopicSignature(
  guildId: string,
  timezone: string,
  locale: SupportedLocale,
  lastRunDate: string | undefined,
  sig: string
): boolean {
  const expected = computeTopicSignature(guildId, timezone, locale, lastRunDate);
  if (!expected) return false;
  const actualBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  return actualBuf.length === expectedBuf.length && timingSafeEqual(actualBuf, expectedBuf);
}

export function parseUtcOffsetMinutes(tz: string): number | null {
  if (!tz || typeof tz !== 'string') return null;
  const trimmed = tz.trim();
  if (!trimmed) return null;

  const match = UTC_OFFSET_REGEX.exec(trimmed);
  if (!match) return null;

  const sign = match[1];
  const hours = Number(match[2]);
  const minutes = match[3] ? Number(match[3]) : 0;

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 14 || minutes < 0 || minutes > 59) return null;

  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes > 14 * 60) return null;
  if (totalMinutes === 0) return 0;

  return sign === '-' ? -totalMinutes : totalMinutes;
}

export function normalizeTimeZone(tz: string): string | null {
  if (!tz || typeof tz !== 'string') return null;
  const trimmed = tz.trim();
  if (!trimmed) return null;

  const offsetMinutes = parseUtcOffsetMinutes(trimmed);
  if (offsetMinutes !== null) {
    if (offsetMinutes === 0) return 'UTC';
    const sign = offsetMinutes > 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const hours = Math.floor(abs / 60);
    const minutes = abs % 60;
    return minutes === 0
      ? `${sign}${hours}`
      : `${sign}${hours}:${String(minutes).padStart(2, '0')}`;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return trimmed;
  } catch {
    return null;
  }
}

export function isValidTimeZone(tz: string): boolean {
  return normalizeTimeZone(tz) !== null;
}

export function formatConfigTopic(
  timezone: string,
  locale: string,
  options?: { lastRunDate?: string; guildId?: string }
): string {
  const safeTz = normalizeTimeZone(timezone) ?? DEFAULT_TIMEZONE;
  const safeLocale = normalizeLocale(locale);
  const safeLast =
    options?.lastRunDate && DATE_KEY_REGEX.test(options.lastRunDate)
      ? options.lastRunDate
      : undefined;

  const parts = [`tz=${safeTz}`, `lang=${safeLocale}`];
  if (safeLast) {
    parts.push(`last=${safeLast}`);
  }
  if (options?.guildId) {
    const sig = computeTopicSignature(options.guildId, safeTz, safeLocale, safeLast);
    if (sig) {
      parts.push(`sig=${sig}`);
    }
  }
  return parts.join(';');
}

export function parseConfigFromTopic(
  topic?: string | null,
  guildId?: string
): {
  timezone: string;
  locale: SupportedLocale;
  lastRunDate?: string;
  hasSignature: boolean;
  hasValidSignature: boolean;
} {
  let timezone = DEFAULT_TIMEZONE;
  let locale: SupportedLocale = DEFAULT_LOCALE;
  let lastRunDate: string | undefined;
  let sig: string | undefined;

  if (!topic || typeof topic !== 'string') {
    return { timezone, locale, hasSignature: false, hasValidSignature: false };
  }

  const segments = topic.split(';');
  for (const segment of segments) {
    const eqIndex = segment.indexOf('=');
    if (eqIndex === -1) continue;
    const key = segment.slice(0, eqIndex).trim().toLowerCase();
    const val = segment.slice(eqIndex + 1).trim();

    if (key === 'tz') {
      const normalizedTz = normalizeTimeZone(val);
      if (normalizedTz) {
        timezone = normalizedTz;
      }
    } else if (key === 'lang') {
      locale = normalizeLocale(val);
    } else if (key === 'last' && DATE_KEY_REGEX.test(val)) {
      lastRunDate = val;
    } else if (key === 'sig' && val) {
      sig = val;
    }
  }

  const hasSignature = Boolean(sig);
  const hasValidSignature = Boolean(
    guildId && sig && verifyTopicSignature(guildId, timezone, locale, lastRunDate, sig)
  );

  return { timezone, locale, lastRunDate, hasSignature, hasValidSignature };
}

function hasEveryoneDeniedView(channel: CategoryChannel | TextChannel): boolean {
  const everyoneOverwrite = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
  return Boolean(everyoneOverwrite?.deny.has(PermissionsBitField.Flags.ViewChannel));
}

function compareSnowflakesOldestFirst(
  a: { createdTimestamp: number; id: string },
  b: { createdTimestamp: number; id: string }
): number {
  if (a.createdTimestamp !== b.createdTimestamp) {
    return a.createdTimestamp - b.createdTimestamp;
  }
  return a.id.localeCompare(b.id);
}

export function findLogotoCategory(guild: Guild): CategoryChannel | null {
  const cachedCategoryId = verifiedGuildCache.get(guild.id)?.categoryId;
  const candidates = Array.from(guild.channels.cache.values()).filter(
    (ch): ch is CategoryChannel =>
      ch.type === ChannelType.GuildCategory && ch.name.toLowerCase() === CATEGORY_NAME.toLowerCase()
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  candidates.sort((a, b) => {
    const score = (cat: CategoryChannel): number => {
      let s = 0;
      if (cachedCategoryId && cat.id === cachedCategoryId) s += 1000;
      const children = guild.channels.cache.filter(
        (ch): ch is TextChannel => ch.type === ChannelType.GuildText && ch.parentId === cat.id
      );
      const hasSignedLog = children.some(
        (ch) =>
          ch.name.toLowerCase() === LOG_CHANNEL_NAME &&
          parseConfigFromTopic(ch.topic, guild.id).hasValidSignature
      );
      if (hasSignedLog) s += 500;
      if (children.some((ch) => ch.name.toLowerCase() === LOG_CHANNEL_NAME)) s += 100;
      if (hasEveryoneDeniedView(cat)) s += 50;
      return s;
    };

    const diff = score(b) - score(a);
    return diff !== 0 ? diff : compareSnowflakesOldestFirst(a, b);
  });

  return candidates[0];
}

export function findLogChannel(guild: Guild, category?: CategoryChannel | null): TextChannel | null {
  const targetCategory = category ?? findLogotoCategory(guild);
  const cachedLogId = verifiedGuildCache.get(guild.id)?.logChannelId;

  const candidates = Array.from(guild.channels.cache.values()).filter(
    (ch): ch is TextChannel =>
      ch.type === ChannelType.GuildText && ch.name.toLowerCase() === LOG_CHANNEL_NAME
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  candidates.sort((a, b) => {
    const score = (ch: TextChannel): number => {
      let s = 0;
      if (cachedLogId && ch.id === cachedLogId) s += 1000;
      if (parseConfigFromTopic(ch.topic, guild.id).hasValidSignature) s += 500;
      if (targetCategory && ch.parentId === targetCategory.id) s += 200;
      if (hasEveryoneDeniedView(ch)) s += 50;
      return s;
    };

    const diff = score(b) - score(a);
    return diff !== 0 ? diff : compareSnowflakesOldestFirst(a, b);
  });

  return candidates[0];
}

export function buildPrivateOverwrites(guild: Guild) {
  const botId = guild.client.user?.id;
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.SendMessages,
      ],
    },
  ];

  if (botId) {
    const allow = [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.EmbedLinks,
    ];
    if (guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageWebhooks)) {
      allow.push(PermissionsBitField.Flags.ManageWebhooks);
    }
    overwrites.push({
      id: botId,
      allow,
    } as never);
  }

  return overwrites;
}

export async function ensureLogotoCategory(guild: Guild): Promise<CategoryChannel> {
  const existing = findLogotoCategory(guild);
  if (existing) {
    if (!hasEveryoneDeniedView(existing)) {
      await existing.permissionOverwrites
        .edit(guild.roles.everyone.id, {
          ViewChannel: false,
          ManageChannels: false,
          SendMessages: false,
        })
        .catch(() => {});
    }
    return existing;
  }

  const created = await guild.channels.create({
    name: CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    permissionOverwrites: buildPrivateOverwrites(guild),
    reason: 'Logoto configuration category',
  });
  return created;
}

export async function ensureLogChannel(
  guild: Guild
): Promise<{ category: CategoryChannel; logChannel: TextChannel; created: boolean }> {
  const category = await ensureLogotoCategory(guild);
  const existing = findLogChannel(guild, category);

  if (existing) {
    if (existing.parentId !== category.id) {
      await existing.setParent(category.id, { lockPermissions: false }).catch(() => {});
    }
    if (!hasEveryoneDeniedView(existing)) {
      await existing.permissionOverwrites
        .edit(guild.roles.everyone.id, {
          ViewChannel: false,
          ManageChannels: false,
          SendMessages: false,
        })
        .catch(() => {});
    }
    const botId = guild.client.user?.id;
    if (botId && guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageWebhooks)) {
      await existing.permissionOverwrites
        .edit(botId, {
          ViewChannel: true,
          SendMessages: true,
          ManageChannels: true,
          EmbedLinks: true,
          ManageWebhooks: true,
        })
        .catch(() => {});
    }
    return { category, logChannel: existing, created: false };
  }

  const logChannel = await guild.channels.create({
    name: LOG_CHANNEL_NAME,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: buildPrivateOverwrites(guild),
    topic: formatConfigTopic(DEFAULT_TIMEZONE, DEFAULT_LOCALE, { guildId: guild.id }),
    reason: 'Logoto configuration and logs channel',
  });

  verifiedGuildCache.set(guild.id, {
    categoryId: category.id,
    logChannelId: logChannel.id,
    timezone: DEFAULT_TIMEZONE,
    locale: DEFAULT_LOCALE,
    signed: Boolean(getSigningSecret()),
  });

  return { category, logChannel, created: true };
}

export async function getGuildConfig(guild: Guild): Promise<GuildConfig> {
  const category = findLogotoCategory(guild);
  const logChannel = findLogChannel(guild, category);

  if (!logChannel) {
    return {
      timezone: DEFAULT_TIMEZONE,
      locale: DEFAULT_LOCALE,
      category,
      logChannel: null,
    };
  }

  const parsed = parseConfigFromTopic(logChannel.topic, guild.id);
  const cached = verifiedGuildCache.get(guild.id);
  const secretConfigured = Boolean(getSigningSecret());

  const tampered =
    (secretConfigured && parsed.hasSignature && !parsed.hasValidSignature) ||
    (secretConfigured && !parsed.hasSignature && Boolean(cached?.signed));

  if (tampered) {
    console.warn(
      `[Logoto] Ignored tampered or stripped config topic on guild ${guild.id}/${logChannel.id}.`
    );
    return {
      timezone: cached?.timezone ?? DEFAULT_TIMEZONE,
      locale: cached?.locale ?? DEFAULT_LOCALE,
      lastRunDate: cached?.lastRunDate,
      category,
      logChannel,
    };
  }

  verifiedGuildCache.set(guild.id, {
    categoryId: category?.id ?? cached?.categoryId,
    logChannelId: logChannel.id,
    timezone: parsed.timezone,
    locale: parsed.locale,
    lastRunDate: parsed.lastRunDate,
    signed: parsed.hasValidSignature || Boolean(cached?.signed),
  });

  return {
    timezone: parsed.timezone,
    locale: parsed.locale,
    lastRunDate: parsed.lastRunDate,
    category,
    logChannel,
  };
}

export async function setGuildConfig(
  guild: Guild,
  updates: { timezone?: string; locale?: string; lastRunDate?: string }
): Promise<GuildConfig> {
  const { category, logChannel } = await ensureLogChannel(guild);
  const parsed = parseConfigFromTopic(logChannel.topic, guild.id);
  const cached = verifiedGuildCache.get(guild.id);
  const secretConfigured = Boolean(getSigningSecret());

  const base =
    secretConfigured &&
    ((parsed.hasSignature && !parsed.hasValidSignature) || (!parsed.hasSignature && cached?.signed))
      ? {
          timezone: cached?.timezone ?? DEFAULT_TIMEZONE,
          locale: cached?.locale ?? DEFAULT_LOCALE,
          lastRunDate: cached?.lastRunDate,
        }
      : parsed;

  const nextTimezone =
    updates.timezone !== undefined
      ? normalizeTimeZone(updates.timezone) ?? DEFAULT_TIMEZONE
      : base.timezone;

  const nextLocale =
    updates.locale !== undefined ? normalizeLocale(updates.locale) : base.locale;

  const nextLastRunDate =
    updates.lastRunDate !== undefined ? updates.lastRunDate : base.lastRunDate;

  const topic = formatConfigTopic(nextTimezone, nextLocale, {
    lastRunDate: nextLastRunDate,
    guildId: guild.id,
  });

  try {
    await logChannel.setTopic(topic, 'Logoto configuration update');
  } catch (err) {
    console.error(`[Logoto] Failed to set topic on ${guild.id}/${logChannel.id}:`, err);
    throw err;
  }

  verifiedGuildCache.set(guild.id, {
    categoryId: category.id,
    logChannelId: logChannel.id,
    timezone: nextTimezone,
    locale: nextLocale,
    lastRunDate: nextLastRunDate,
    signed: secretConfigured,
  });

  return {
    timezone: nextTimezone,
    locale: nextLocale,
    lastRunDate: nextLastRunDate,
    category,
    logChannel,
  };
}

export async function markGuildLastRunDate(
  guild: Guild,
  config: GuildConfig,
  dateKey: string
): Promise<void> {
  if (!config.logChannel || !DATE_KEY_REGEX.test(dateKey)) return;
  if (config.lastRunDate === dateKey) return;

  try {
    const topic = formatConfigTopic(config.timezone, config.locale, {
      lastRunDate: dateKey,
      guildId: guild.id,
    });
    await config.logChannel.setTopic(topic, 'Logoto daily schedule checkpoint');
    verifiedGuildCache.set(guild.id, {
      categoryId: config.category?.id,
      logChannelId: config.logChannel.id,
      timezone: config.timezone,
      locale: config.locale,
      lastRunDate: dateKey,
      signed: Boolean(getSigningSecret()),
    });
  } catch (err) {
    console.warn(`[Logoto] Could not persist lastRunDate on ${guild.id}:`, err);
  }
}

export function getLocalDateParts(timezone: string, date: Date = new Date()): LocalDateParts {
  const safeTz = normalizeTimeZone(timezone) ?? DEFAULT_TIMEZONE;
  const offsetMinutes = parseUtcOffsetMinutes(safeTz);

  if (offsetMinutes !== null) {
    const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth() + 1;
    const day = shifted.getUTCDate();
    const hour = shifted.getUTCHours();
    const minute = shifted.getUTCMinutes();
    const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
      year,
      month,
      day,
      hour,
      minute,
      dateKey,
    };
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const rawHour = Number(map.hour);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(map.minute);

  const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    dateKey,
  };
}

export async function sendLogEmbed(guild: Guild, embed: EmbedBuilder): Promise<void> {
  try {
    const config = await getGuildConfig(guild);
    if (!config.logChannel) return;
    await config.logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.warn(`[Logoto] Unable to send log embed in guild ${guild.id}:`, err);
  }
}
