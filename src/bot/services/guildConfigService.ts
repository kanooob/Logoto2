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

export function formatConfigTopic(timezone: string, locale: string): string {
  const safeTz = normalizeTimeZone(timezone) ?? DEFAULT_TIMEZONE;
  const safeLocale = normalizeLocale(locale);
  return `tz=${safeTz};lang=${safeLocale}`;
}

export function parseConfigFromTopic(topic?: string | null): {
  timezone: string;
  locale: SupportedLocale;
} {
  let timezone = DEFAULT_TIMEZONE;
  let locale: SupportedLocale = DEFAULT_LOCALE;

  if (!topic || typeof topic !== 'string') {
    return { timezone, locale };
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
    }
  }

  return { timezone, locale };
}

export function findLogotoCategory(guild: Guild): CategoryChannel | null {
  const category = guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase() === CATEGORY_NAME.toLowerCase()
  );
  return category?.type === ChannelType.GuildCategory ? category : null;
}

export function findLogChannel(guild: Guild, category?: CategoryChannel | null): TextChannel | null {
  const targetCategory = category ?? findLogotoCategory(guild);

  if (targetCategory) {
    const insideCategory = guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildText &&
        ch.parentId === targetCategory.id &&
        ch.name.toLowerCase() === LOG_CHANNEL_NAME
    );
    if (insideCategory?.type === ChannelType.GuildText) {
      return insideCategory;
    }
  }

  const anywhere = guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildText && ch.name.toLowerCase() === LOG_CHANNEL_NAME
  );
  return anywhere?.type === ChannelType.GuildText ? anywhere : null;
}

function buildPrivateOverwrites(guild: Guild) {
  const botId = guild.client.user?.id;
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
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
  if (existing) return existing;

  const created = await guild.channels.create({
    name: CATEGORY_NAME,
    type: ChannelType.GuildCategory,
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
    topic: formatConfigTopic(DEFAULT_TIMEZONE, DEFAULT_LOCALE),
    reason: 'Logoto configuration and logs channel',
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

  const { timezone, locale } = parseConfigFromTopic(logChannel.topic);
  return {
    timezone,
    locale,
    category,
    logChannel,
  };
}

export async function setGuildConfig(
  guild: Guild,
  updates: { timezone?: string; locale?: string }
): Promise<GuildConfig> {
  const { category, logChannel } = await ensureLogChannel(guild);
  const current = parseConfigFromTopic(logChannel.topic);

  const nextTimezone =
    updates.timezone !== undefined
      ? normalizeTimeZone(updates.timezone) ?? DEFAULT_TIMEZONE
      : current.timezone;

  const nextLocale =
    updates.locale !== undefined ? normalizeLocale(updates.locale) : current.locale;

  const topic = formatConfigTopic(nextTimezone, nextLocale);

  try {
    await logChannel.setTopic(topic, 'Logoto configuration update');
  } catch (err) {
    console.error(`[Logoto] Failed to set topic on ${guild.id}/${logChannel.id}:`, err);
    throw err;
  }

  return {
    timezone: nextTimezone,
    locale: nextLocale,
    category,
    logChannel,
  };
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
