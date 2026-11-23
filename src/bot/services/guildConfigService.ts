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

export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  const trimmed = tz.trim();
  if (!trimmed) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

export function formatConfigTopic(timezone: string, locale: string): string {
  const safeTz = isValidTimeZone(timezone) ? timezone.trim() : DEFAULT_TIMEZONE;
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

    if (key === 'tz' && isValidTimeZone(val)) {
      timezone = val;
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
    overwrites.push({
      id: botId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.EmbedLinks,
      ],
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
      ? isValidTimeZone(updates.timezone)
        ? updates.timezone.trim()
        : DEFAULT_TIMEZONE
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
  const safeTz = isValidTimeZone(timezone) ? timezone.trim() : DEFAULT_TIMEZONE;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
