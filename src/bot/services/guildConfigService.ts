import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ChannelType,
  OverwriteType,
  PermissionsBitField,
  type CategoryChannel,
  type EmbedBuilder,
  type Guild,
  type OverwriteResolvable,
  type Role,
  type TextChannel,
} from 'discord.js';
import { normalizeLocale } from '../i18n/index.js';
import type { GuildConfig, LocalDateParts, SupportedLocale } from '../types.js';

export const CATEGORY_NAME = 'Logoto';
export const LOG_CHANNEL_NAME = 'log-logoto';
export const RESTORE_ROLE_NAME = 'Logoto Restore';
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
  restoreRole?: boolean;
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
  lastRunDate?: string,
  restoreRole?: boolean
): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const basePayload = `${guildId}|${timezone}|${locale}|${lastRunDate ?? ''}`;
  const payload = restoreRole ? `${basePayload}|restore=1` : basePayload;
  return createHmac('sha256', secret).update(payload).digest('base64url').slice(0, 16);
}

function verifyTopicSignature(
  guildId: string,
  timezone: string,
  locale: SupportedLocale,
  lastRunDate: string | undefined,
  restoreRole: boolean,
  sig: string
): boolean {
  const expected = computeTopicSignature(guildId, timezone, locale, lastRunDate, restoreRole);
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
  options?: { lastRunDate?: string; restoreRole?: boolean; guildId?: string }
): string {
  const safeTz = normalizeTimeZone(timezone) ?? DEFAULT_TIMEZONE;
  const safeLocale = normalizeLocale(locale);
  const safeLast =
    options?.lastRunDate && DATE_KEY_REGEX.test(options.lastRunDate)
      ? options.lastRunDate
      : undefined;
  const safeRestore = Boolean(options?.restoreRole);

  const parts = [`tz=${safeTz}`, `lang=${safeLocale}`];
  if (safeLast) {
    parts.push(`last=${safeLast}`);
  }
  if (safeRestore) {
    parts.push('restore=1');
  }
  if (options?.guildId) {
    const sig = computeTopicSignature(options.guildId, safeTz, safeLocale, safeLast, safeRestore);
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
  restoreRole: boolean;
  hasSignature: boolean;
  hasValidSignature: boolean;
} {
  let timezone = DEFAULT_TIMEZONE;
  let locale: SupportedLocale = DEFAULT_LOCALE;
  let lastRunDate: string | undefined;
  let restoreRole = false;
  let sig: string | undefined;

  if (!topic || typeof topic !== 'string') {
    return { timezone, locale, restoreRole: false, hasSignature: false, hasValidSignature: false };
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
    } else if (key === 'restore') {
      restoreRole = val === '1' || val.toLowerCase() === 'true';
    } else if (key === 'sig' && val) {
      sig = val;
    }
  }

  const hasSignature = Boolean(sig);
  const hasValidSignature = Boolean(
    guildId && sig && verifyTopicSignature(guildId, timezone, locale, lastRunDate, restoreRole, sig)
  );

  return { timezone, locale, lastRunDate, restoreRole, hasSignature, hasValidSignature };
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

function getBotAllowPermissions(guild: Guild): bigint[] {
  const allow: bigint[] = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ManageChannels,
    PermissionsBitField.Flags.EmbedLinks,
  ];
  if (guild.members.me?.permissions.has(PermissionsBitField.Flags.AttachFiles)) {
    allow.push(PermissionsBitField.Flags.AttachFiles);
  }
  if (guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageWebhooks)) {
    allow.push(PermissionsBitField.Flags.ManageWebhooks);
  }
  return allow;
}

function getBotPermsPatch(guild: Guild): Record<string, boolean> {
  return {
    ViewChannel: true,
    SendMessages: true,
    ManageChannels: true,
    EmbedLinks: true,
    ...(guild.members.me?.permissions.has(PermissionsBitField.Flags.AttachFiles)
      ? { AttachFiles: true }
      : {}),
    ...(guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageWebhooks)
      ? { ManageWebhooks: true }
      : {}),
  };
}

function needsBotOverwriteUpdate(
  channel: CategoryChannel | TextChannel,
  targetId: string,
  allowFlags: bigint[]
): boolean {
  const existing = channel.permissionOverwrites.cache.get(targetId);
  if (!existing) return true;
  return allowFlags.some((flag) => !existing.allow.has(flag));
}

function findBotManagedRoleId(guild: Guild, botId?: string): string | null {
  const role =
    (botId ? guild.roles.botRoleFor(botId) : null) ??
    guild.members.me?.roles.botRole ??
    null;
  if (!role || role.id === guild.roles.everyone.id) return null;
  return role.id;
}

export function findRestoreRole(guild: Guild): Role | null {
  const target = RESTORE_ROLE_NAME.toLowerCase();
  const matches = Array.from(guild.roles.cache.values()).filter(
    (role) => !role.managed && role.id !== guild.roles.everyone.id && role.name.toLowerCase() === target
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const me = guild.members.me;
  const assigned = me ? matches.find((r) => me.roles.cache.has(r.id)) : undefined;
  if (assigned) return assigned;

  matches.sort((a, b) => compareSnowflakesOldestFirst(a, b));
  return matches[0];
}

export function canBotManageRoles(guild: Guild): boolean {
  return Boolean(guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageRoles));
}

export function buildPrivateOverwrites(guild: Guild): OverwriteResolvable[] {
  const botId = guild.client.user?.id;
  const overwrites: OverwriteResolvable[] = [
    {
      id: guild.roles.everyone.id,
      type: OverwriteType.Role,
      deny: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.SendMessages,
      ],
    },
  ];

  const allow = getBotAllowPermissions(guild);
  const botRoleId = findBotManagedRoleId(guild, botId);

  if (botRoleId) {
    overwrites.push({
      id: botRoleId,
      type: OverwriteType.Role,
      allow,
    });
  }

  if (botId) {
    overwrites.push({
      id: botId,
      type: OverwriteType.Member,
      allow,
    });
  }

  const restoreRole = findRestoreRole(guild);
  if (restoreRole) {
    overwrites.push({
      id: restoreRole.id,
      type: OverwriteType.Role,
      allow,
    });
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
    const botId = guild.client.user?.id;
    const botRoleId = findBotManagedRoleId(guild, botId);
    const botPermsPatch = getBotPermsPatch(guild);
    if (botRoleId && !existing.permissionOverwrites.cache.has(botRoleId)) {
      await existing.permissionOverwrites.edit(botRoleId, botPermsPatch).catch(() => {});
    }
    if (botId && !existing.permissionOverwrites.cache.has(botId)) {
      await existing.permissionOverwrites.edit(botId, botPermsPatch).catch(() => {});
    }
    const restoreRole = findRestoreRole(guild);
    if (restoreRole && !existing.permissionOverwrites.cache.has(restoreRole.id)) {
      await existing.permissionOverwrites.edit(restoreRole.id, botPermsPatch).catch(() => {});
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
    const botRoleId = findBotManagedRoleId(guild, botId);
    const botAllowFlags = getBotAllowPermissions(guild);
    const botPermsPatch = getBotPermsPatch(guild);
    if (botRoleId && needsBotOverwriteUpdate(existing, botRoleId, botAllowFlags)) {
      await existing.permissionOverwrites.edit(botRoleId, botPermsPatch).catch(() => {});
    }
    if (botId && needsBotOverwriteUpdate(existing, botId, botAllowFlags)) {
      await existing.permissionOverwrites.edit(botId, botPermsPatch).catch(() => {});
    }
    const restoreRole = findRestoreRole(guild);
    if (restoreRole && needsBotOverwriteUpdate(existing, restoreRole.id, botAllowFlags)) {
      await existing.permissionOverwrites.edit(restoreRole.id, botPermsPatch).catch(() => {});
    }
    return { category, logChannel: existing, created: false };
  }

  const restoreRole = findRestoreRole(guild);
  const restoreActive = Boolean(restoreRole && guild.members.me?.roles.cache.has(restoreRole.id));

  const logChannel = await guild.channels.create({
    name: LOG_CHANNEL_NAME,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: buildPrivateOverwrites(guild),
    topic: formatConfigTopic(DEFAULT_TIMEZONE, DEFAULT_LOCALE, {
      restoreRole: restoreActive,
      guildId: guild.id,
    }),
    reason: 'Logoto configuration and logs channel',
  });

  verifiedGuildCache.set(guild.id, {
    categoryId: category.id,
    logChannelId: logChannel.id,
    timezone: DEFAULT_TIMEZONE,
    locale: DEFAULT_LOCALE,
    restoreRole: restoreActive,
    signed: Boolean(getSigningSecret()),
  });

  return { category, logChannel, created: true };
}

export async function syncRestoreRoleOverwrites(guild: Guild, role: Role): Promise<number> {
  const category = findLogotoCategory(guild);
  const logChannel = findLogChannel(guild, category);
  const botId = guild.client.user?.id;
  const botRoleId = findBotManagedRoleId(guild, botId);
  const botPermsPatch = getBotPermsPatch(guild);

  const channelsToSync = new Map<string, CategoryChannel | TextChannel>();
  if (category) {
    channelsToSync.set(category.id, category);
  }
  if (logChannel) {
    channelsToSync.set(logChannel.id, logChannel);
  }
  if (category) {
    for (const ch of guild.channels.cache.values()) {
      if (ch.type === ChannelType.GuildText && ch.parentId === category.id) {
        channelsToSync.set(ch.id, ch);
      }
    }
  }

  let synced = 0;
  for (const ch of channelsToSync.values()) {
    try {
      await ch.permissionOverwrites.edit(role.id, botPermsPatch);
      if (botRoleId) {
        await ch.permissionOverwrites.edit(botRoleId, botPermsPatch).catch(() => {});
      }
      if (botId) {
        await ch.permissionOverwrites.edit(botId, botPermsPatch).catch(() => {});
      }
      synced += 1;
    } catch (err) {
      console.warn(`[Logoto] Failed to sync restore role overwrites on ${guild.id}/${ch.id}:`, err);
    }
  }
  return synced;
}

export type RestoreRoleActionResult =
  | { ok: true; role: Role; syncedChannels: number; createdRole: boolean }
  | { ok: false; reason: 'missing_member' | 'missing_manage_roles' | 'role_hierarchy' };

export async function enableRestoreRole(guild: Guild): Promise<RestoreRoleActionResult> {
  const me = (await guild.members.fetchMe().catch(() => null)) ?? guild.members.me;
  if (!me) {
    return { ok: false, reason: 'missing_member' };
  }
  if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return { ok: false, reason: 'missing_manage_roles' };
  }

  await guild.roles.fetch().catch(() => null);
  let role = findRestoreRole(guild);
  let createdRole = false;

  if (!role) {
    role = await guild.roles.create({
      name: RESTORE_ROLE_NAME,
      permissions: [],
      hoist: false,
      mentionable: false,
      reason: 'Logoto Restore role (no server-wide permissions)',
    });
    createdRole = true;
  } else if (!me.roles.cache.has(role.id) && role.position >= me.roles.highest.position) {
    return { ok: false, reason: 'role_hierarchy' };
  }

  if (!me.roles.cache.has(role.id)) {
    await me.roles.add(role, 'Logoto Restore role assignment');
    await guild.channels.fetch().catch(() => null);
  }

  const syncedChannels = await syncRestoreRoleOverwrites(guild, role);
  if (findLogChannel(guild)) {
    await setGuildConfig(guild, { restoreRole: true });
  }

  return { ok: true, role, syncedChannels, createdRole };
}

export type DisableRestoreRoleResult =
  | { ok: true; deletedRole: boolean }
  | { ok: false; reason: 'missing_member' | 'missing_manage_roles' | 'role_hierarchy' };

export async function disableRestoreRole(guild: Guild): Promise<DisableRestoreRoleResult> {
  const me = (await guild.members.fetchMe().catch(() => null)) ?? guild.members.me;
  if (!me) {
    return { ok: false, reason: 'missing_member' };
  }

  await guild.roles.fetch().catch(() => null);
  const role = findRestoreRole(guild);
  let deletedRole = false;

  if (role) {
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return { ok: false, reason: 'missing_manage_roles' };
    }
    if (role.position >= me.roles.highest.position) {
      return { ok: false, reason: 'role_hierarchy' };
    }
    await role.delete('Logoto Restore disabled');
    deletedRole = true;
  }

  if (findLogChannel(guild)) {
    await setGuildConfig(guild, { restoreRole: false });
  }

  return { ok: true, deletedRole };
}

export async function restoreBotAccessOnJoin(
  guild: Guild
): Promise<{ restored: boolean; syncedChannels: number }> {
  try {
    await guild.roles.fetch().catch(() => null);
    const role = findRestoreRole(guild);
    if (!role) {
      return { restored: false, syncedChannels: 0 };
    }

    const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    if (
      !me ||
      !me.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
      role.position >= me.roles.highest.position
    ) {
      return { restored: false, syncedChannels: 0 };
    }

    let roleAdded = false;
    if (!me.roles.cache.has(role.id)) {
      await me.roles.add(role, 'Logoto Restore: regaining access to configuration channels');
      roleAdded = true;
    }

    await guild.channels.fetch().catch(() => null);
    const syncedChannels = await syncRestoreRoleOverwrites(guild, role);
    const logChannel = findLogChannel(guild);
    if (logChannel) {
      const parsed = parseConfigFromTopic(logChannel.topic, guild.id);
      if (!parsed.restoreRole) {
        await setGuildConfig(guild, { restoreRole: true }).catch(() => {});
      }
    }

    return { restored: roleAdded, syncedChannels };
  } catch (err) {
    console.warn(`[Logoto] Failed to restore access via Logoto Restore in guild ${guild.id}:`, err);
    return { restored: false, syncedChannels: 0 };
  }
}

export async function getGuildConfig(guild: Guild): Promise<GuildConfig> {
  const category = findLogotoCategory(guild);
  const logChannel = findLogChannel(guild, category);
  const restoreRole = findRestoreRole(guild);
  const botHasRestoreRole = Boolean(restoreRole && guild.members.me?.roles.cache.has(restoreRole.id));

  if (!logChannel) {
    return {
      timezone: DEFAULT_TIMEZONE,
      locale: DEFAULT_LOCALE,
      category,
      logChannel: null,
      restoreRoleEnabled: botHasRestoreRole,
      restoreRoleId: restoreRole?.id ?? null,
      restoreRoleName: restoreRole?.name ?? null,
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
      restoreRoleEnabled: botHasRestoreRole,
      restoreRoleId: restoreRole?.id ?? null,
      restoreRoleName: restoreRole?.name ?? null,
    };
  }

  const restoreRoleEnabled = botHasRestoreRole;

  verifiedGuildCache.set(guild.id, {
    categoryId: category?.id ?? cached?.categoryId,
    logChannelId: logChannel.id,
    timezone: parsed.timezone,
    locale: parsed.locale,
    lastRunDate: parsed.lastRunDate,
    restoreRole: parsed.restoreRole || botHasRestoreRole,
    signed: parsed.hasValidSignature || Boolean(cached?.signed),
  });

  return {
    timezone: parsed.timezone,
    locale: parsed.locale,
    lastRunDate: parsed.lastRunDate,
    category,
    logChannel,
    restoreRoleEnabled,
    restoreRoleId: restoreRole?.id ?? null,
    restoreRoleName: restoreRole?.name ?? null,
  };
}

export async function setGuildConfig(
  guild: Guild,
  updates: { timezone?: string; locale?: string; lastRunDate?: string; restoreRole?: boolean }
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
          restoreRole: cached?.restoreRole ?? false,
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

  const restoreRoleObj = findRestoreRole(guild);
  const nextRestoreRole =
    updates.restoreRole !== undefined ? updates.restoreRole : base.restoreRole;

  const topic = formatConfigTopic(nextTimezone, nextLocale, {
    lastRunDate: nextLastRunDate,
    restoreRole: nextRestoreRole,
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
    restoreRole: nextRestoreRole,
    signed: secretConfigured,
  });

  const botHasRestoreRole = Boolean(
    restoreRoleObj && guild.members.me?.roles.cache.has(restoreRoleObj.id)
  );

  return {
    timezone: nextTimezone,
    locale: nextLocale,
    lastRunDate: nextLastRunDate,
    category,
    logChannel,
    restoreRoleEnabled: botHasRestoreRole,
    restoreRoleId: restoreRoleObj?.id ?? null,
    restoreRoleName: restoreRoleObj?.name ?? null,
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
      restoreRole: config.restoreRoleEnabled,
      guildId: guild.id,
    });
    await config.logChannel.setTopic(topic, 'Logoto daily schedule checkpoint');
    verifiedGuildCache.set(guild.id, {
      categoryId: config.category?.id,
      logChannelId: config.logChannel.id,
      timezone: config.timezone,
      locale: config.locale,
      lastRunDate: dateKey,
      restoreRole: config.restoreRoleEnabled,
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
