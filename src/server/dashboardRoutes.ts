import { createHash } from 'node:crypto';
import { AttachmentBuilder, EmbedBuilder, PermissionsBitField, type Client, type Guild } from 'discord.js';
import express, { type Express, type NextFunction, type Response } from 'express';
import { followAnnouncementsInLogChannel } from '../bot/commands/setupCommand.js';
import { t } from '../bot/i18n/index.js';
import {
  buildEventChannelName,
  deleteEvent,
  listEvents,
  parseEventChannelName,
  updateEventChannel,
  upsertEvent,
} from '../bot/services/eventService.js';
import {
  canBotManageRoles,
  disableRestoreRole,
  enableRestoreRole,
  ensureLogChannel,
  findRestoreRole,
  formatConfigTopic,
  getGuildConfig,
  getLocalDateParts,
  isValidTimeZone,
  normalizeTimeZone,
  parseConfigFromTopic,
  setGuildConfig,
  syncRestoreRoleOverwrites,
} from '../bot/services/guildConfigService.js';
import { PRIMARY_COLOR, type EventType, type SupportedLocale } from '../bot/types.js';
import {
  checkBotGuildPermissions,
  formatLocalDateTimeDisplay,
  getBoostRequirementWarning,
  isSafeImageUrl,
  isValidDayForMonth,
  isValidServerName,
} from '../bot/utils/validators.js';
import {
  refreshSessionGuildsIfNeeded,
  requireDiscordAuth,
  type AuthenticatedRequest,
} from './auth.js';

function parseImportEntries(rawText: string): Array<{ name: string; topic: string }> {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsedJson = JSON.parse(trimmed) as unknown;
      const entries: Array<{ name: string; topic: string }> = [];
      if (Array.isArray(parsedJson)) {
        for (const item of parsedJson) {
          if (item && typeof item === 'object' && 'name' in item && 'topic' in item) {
            entries.push({
              name: String((item as { name: unknown }).name).trim(),
              topic: String((item as { topic: unknown }).topic).trim(),
            });
          }
        }
        return entries;
      }
      if (parsedJson && typeof parsedJson === 'object' && 'channels' in parsedJson) {
        const channels = (parsedJson as { channels?: unknown }).channels;
        if (Array.isArray(channels)) {
          for (const item of channels) {
            if (item && typeof item === 'object' && 'name' in item && 'topic' in item) {
              entries.push({
                name: String((item as { name: unknown }).name).trim(),
                topic: String((item as { topic: unknown }).topic).trim(),
              });
            }
          }
          return entries;
        }
      }
    } catch {
      // Fallback to line-based parsing
    }
  }

  const results: Array<{ name: string; topic: string }> = [];
  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;
    const name = line.slice(0, colonIdx).trim();
    const topic = line.slice(colonIdx + 1).trim();
    if (name && topic) {
      results.push({ name, topic });
    }
  }
  return results;
}

async function resolveAuthorizedBotGuild(
  req: AuthenticatedRequest,
  res: Response,
  getDiscordClient: () => Client | null
): Promise<Guild | null> {
  const session = req.discordSession;
  if (!session) {
    res.status(401).json({ error: 'Authentification requise.' });
    return null;
  }

  const guildId = String(req.params.guildId ?? '').trim();
  if (!/^\d{15,22}$/.test(guildId)) {
    res.status(400).json({ error: 'Identifiant de serveur Discord invalide.' });
    return null;
  }

  await refreshSessionGuildsIfNeeded(session);
  const allowed = session.guilds.some((g) => g.id === guildId);
  if (!allowed) {
    res.status(403).json({
      error: 'Vous devez disposer des permissions Administrateur ou Gérer le serveur sur ce serveur.',
    });
    return null;
  }

  const client = getDiscordClient();
  if (!client || !client.isReady()) {
    res.status(503).json({ error: 'Le bot Discord est actuellement hors ligne.' });
    return null;
  }

  const guild =
    client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) {
    res.status(404).json({
      error: "Logoto n'est pas présent sur ce serveur Discord.",
      botMissing: true,
    });
    return null;
  }

  await Promise.all([
    guild.members.fetchMe().catch(() => null),
    guild.channels.fetch().catch(() => null),
    guild.roles.fetch().catch(() => null),
  ]);
  return guild;
}

function getRestoreErrorMessage(
  locale: SupportedLocale,
  reason: 'missing_member' | 'missing_manage_roles' | 'role_hierarchy'
): string {
  if (reason === 'missing_manage_roles') return t(locale, 'restoreMissingManageRoles');
  if (reason === 'role_hierarchy') return t(locale, 'restoreRoleHierarchyError');
  return t(locale, 'restoreMissingMember');
}

async function buildGuildDetailResponse(guild: Guild) {
  const config = await getGuildConfig(guild);
  const locale = config.locale;
  const botPerms = await checkBotGuildPermissions(guild, locale);
  const events = await listEvents(guild);

  return {
    guild: {
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL({ size: 128 }),
      premiumTier: guild.premiumTier,
    },
    configured: Boolean(config.logChannel),
    config: {
      timezone: config.timezone,
      locale: config.locale,
      logChannelId: config.logChannel?.id ?? null,
      logChannelName: config.logChannel?.name ?? null,
      restoreRoleEnabled: config.restoreRoleEnabled,
      restoreRoleId: config.restoreRoleId ?? null,
      restoreRoleName: config.restoreRoleName ?? null,
      topic: formatConfigTopic(config.timezone, config.locale, {
        restoreRole: config.restoreRoleEnabled,
      }),
      localTime: formatLocalDateTimeDisplay(config.timezone, config.locale),
    },
    botPermissionsOk: botPerms.ok,
    botPermissionsError: botPerms.ok ? null : botPerms.embed.data.description ?? null,
    botCanManageRoles: canBotManageRoles(guild),
    events: events.map((ev) => ({
      id: ev.channel.id,
      channelName: buildEventChannelName(ev.type, ev.day, ev.month),
      type: ev.type,
      day: ev.day,
      month: ev.month,
      value: ev.value,
      boostWarning: getBoostRequirementWarning(guild, ev.type, locale),
    })),
  };
}

export function registerDashboardRoutes(
  app: Express,
  getDiscordClient: () => Client | null
): void {
  // List all Discord guilds managed by the authenticated user
  app.get('/api/dashboard/guilds', requireDiscordAuth, async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const session = req.discordSession!;
    await refreshSessionGuildsIfNeeded(session);
    const client = getDiscordClient();
    const botReady = Boolean(client?.isReady());

    const items = await Promise.all(
      session.guilds.map(async (g) => {
        const botGuild = botReady && client ? client.guilds.cache.get(g.id) ?? null : null;
        let configured = false;
        let timezone: string | null = null;
        let locale: SupportedLocale | null = null;

        if (botGuild) {
          await botGuild.channels.fetch().catch(() => null);
          const cfg = await getGuildConfig(botGuild);
          configured = Boolean(cfg.logChannel);
          timezone = cfg.timezone;
          locale = cfg.locale;
        }

        const iconUrl = g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
          : null;

        return {
          id: g.id,
          name: g.name,
          iconUrl,
          owner: g.owner,
          botPresent: Boolean(botGuild),
          configured,
          timezone,
          locale,
          premiumTier: botGuild?.premiumTier ?? 0,
        };
      })
    );

    items.sort((a, b) => {
      if (a.botPresent !== b.botPresent) return a.botPresent ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      botOnline: botReady,
      guilds: items,
    });
  });

  // Get full /settings state for one guild
  app.get('/api/dashboard/guilds/:guildId', requireDiscordAuth, async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const guild = await resolveAuthorizedBotGuild(req, res, getDiscordClient);
    if (!guild) return;

    res.json(await buildGuildDetailResponse(guild));
  });

  // Run /setup from the web dashboard
  app.post('/api/dashboard/guilds/:guildId/setup', requireDiscordAuth, async (req: AuthenticatedRequest, res) => {
    const guild = await resolveAuthorizedBotGuild(req, res, getDiscordClient);
    if (!guild) return;

    const rawLocale = req.body?.locale === 'en' ? 'en' : 'fr';
    const rawTz = typeof req.body?.timezone === 'string' ? req.body.timezone.trim() : 'UTC';
    const wantRestoreRole = req.body?.restoreRole === true;
    if (!isValidTimeZone(rawTz)) {
      res.status(400).json({ error: t(rawLocale, 'invalidTimezone', { tz: rawTz }) });
      return;
    }

    const perms = await checkBotGuildPermissions(guild, rawLocale);
    if (!perms.ok) {
      res.status(403).json({ error: perms.embed.data.description ?? 'Permissions du bot manquantes.' });
      return;
    }

    const normalizedTz = normalizeTimeZone(rawTz) ?? 'UTC';
    const existing = await getGuildConfig(guild);
    const { logChannel, created } = await ensureLogChannel(guild);
    const todayKey = getLocalDateParts(normalizedTz).dateKey;

    const updated = await setGuildConfig(guild, {
      timezone: normalizedTz,
      locale: rawLocale,
      lastRunDate: existing.lastRunDate ?? todayKey,
    });

    if (wantRestoreRole) {
      const roleRes = await enableRestoreRole(guild);
      if (!roleRes.ok) {
        res.status(403).json({ error: getRestoreErrorMessage(rawLocale, roleRes.reason) });
        return;
      }
    }

    if (created) {
      const topic = formatConfigTopic(updated.timezone, updated.locale, {
        restoreRole: wantRestoreRole || updated.restoreRoleEnabled,
      });
      const summaryEmbed = new EmbedBuilder()
        .setColor(PRIMARY_COLOR)
        .setTitle(t(updated.locale, 'pinnedSummaryTitle'))
        .setDescription(t(updated.locale, 'pinnedSummaryDesc'))
        .setFooter({ text: t(updated.locale, 'pinnedSummaryFooter', { topic }) })
        .setTimestamp();

      try {
        const sent = await logChannel.send({ embeds: [summaryEmbed] });
        await sent.pin().catch(() => {});
      } catch {
        // Ignore pin failures
      }
      await followAnnouncementsInLogChannel(guild, logChannel);
    }

    await guild.channels.fetch().catch(() => null);
    res.json(await buildGuildDetailResponse(guild));
  });

  // Update timezone, language, and/or Logoto Restore role (/settings)
  app.patch('/api/dashboard/guilds/:guildId/config', requireDiscordAuth, async (req: AuthenticatedRequest, res) => {
    const guild = await resolveAuthorizedBotGuild(req, res, getDiscordClient);
    if (!guild) return;

    const current = await getGuildConfig(guild);
    const nextLocale: SupportedLocale =
      req.body?.locale === 'fr' || req.body?.locale === 'en' ? req.body.locale : current.locale;

    if (req.body?.restoreRole === true) {
      const roleRes = await enableRestoreRole(guild);
      if (!roleRes.ok) {
        res.status(403).json({ error: getRestoreErrorMessage(nextLocale, roleRes.reason) });
        return;
      }
      await guild.channels.fetch().catch(() => null);
    }

    const needsChannelPermsCheck =
      req.body?.timezone !== undefined ||
      Boolean(req.body?.locale) ||
      req.body?.restoreRole === false ||
      req.body?.syncRestoreRole === true;

    if (needsChannelPermsCheck) {
      const perms = await checkBotGuildPermissions(guild, nextLocale);
      if (!perms.ok) {
        res.status(403).json({ error: perms.embed.data.description ?? 'Permissions du bot manquantes.' });
        return;
      }
    }

    let nextTz: string | undefined;
    if (typeof req.body?.timezone === 'string') {
      const candidate = req.body.timezone.trim();
      if (!isValidTimeZone(candidate)) {
        res.status(400).json({ error: t(nextLocale, 'invalidTimezone', { tz: candidate }) });
        return;
      }
      nextTz = candidate;
    }

    if (nextTz !== undefined || req.body?.locale) {
      await setGuildConfig(guild, {
        timezone: nextTz,
        locale: req.body?.locale ? nextLocale : undefined,
      });
    }

    if (req.body?.restoreRole === false) {
      const roleRes = await disableRestoreRole(guild);
      if (!roleRes.ok) {
        res.status(403).json({ error: getRestoreErrorMessage(nextLocale, roleRes.reason) });
        return;
      }
    } else if (req.body?.restoreRole !== true && req.body?.syncRestoreRole === true) {
      const existingRole = findRestoreRole(guild);
      if (existingRole) {
        await syncRestoreRoleOverwrites(guild, existingRole);
      } else {
        const roleRes = await enableRestoreRole(guild);
        if (!roleRes.ok) {
          res.status(403).json({ error: getRestoreErrorMessage(nextLocale, roleRes.reason) });
          return;
        }
      }
    }

    await guild.channels.fetch().catch(() => null);
    res.json(await buildGuildDetailResponse(guild));
  });

  // Create or overwrite scheduled event (/settings -> Créer un événement)
  app.post('/api/dashboard/guilds/:guildId/events', requireDiscordAuth, async (req: AuthenticatedRequest, res) => {
    const guild = await resolveAuthorizedBotGuild(req, res, getDiscordClient);
    if (!guild) return;

    const cfg = await getGuildConfig(guild);
    const perms = await checkBotGuildPermissions(guild, cfg.locale);
    if (!perms.ok) {
      res.status(403).json({ error: perms.embed.data.description ?? 'Permissions du bot manquantes.' });
      return;
    }

    const type = req.body?.type as EventType;
    const month = Number(req.body?.month);
    const day = Number(req.body?.day);
    const value = typeof req.body?.value === 'string' ? req.body.value.trim() : '';

    if (type !== 'l' && type !== 'n' && type !== 'b' && type !== 'i') {
      res.status(400).json({ error: 'Type invalide (l, n, b ou i).' });
      return;
    }
    if (!isValidDayForMonth(day, month)) {
      res.status(400).json({ error: `Date invalide (${day}/${month}).` });
      return;
    }

    if (type === 'n') {
      if (!isValidServerName(value)) {
        res.status(400).json({ error: t(cfg.locale, 'invalidServerName') });
        return;
      }
    } else if (!isSafeImageUrl(value)) {
      res.status(400).json({ error: t(cfg.locale, 'invalidImageUrl') });
      return;
    }

    await upsertEvent(guild, { type, day, month, value });
    await guild.channels.fetch().catch(() => null);
    res.json(await buildGuildDetailResponse(guild));
  });

  // Edit event value or date/type (/settings -> Modifier / Supprimer)
  app.patch(
    '/api/dashboard/guilds/:guildId/events/:channelId',
    requireDiscordAuth,
    async (req: AuthenticatedRequest, res) => {
      const guild = await resolveAuthorizedBotGuild(req, res, getDiscordClient);
      if (!guild) return;

      const cfg = await getGuildConfig(guild);
      const perms = await checkBotGuildPermissions(guild, cfg.locale);
      if (!perms.ok) {
        res.status(403).json({ error: perms.embed.data.description ?? 'Permissions du bot manquantes.' });
        return;
      }

      const channelId = String(req.params.channelId ?? '').trim();
      if (!/^\d{15,22}$/.test(channelId)) {
        res.status(400).json({ error: 'Identifiant de salon invalide.' });
        return;
      }
      const ch = guild.channels.cache.get(channelId);
      const existingParsed = ch ? parseEventChannelName(ch.name) : null;
      if (!ch || !existingParsed) {
        res.status(404).json({ error: 'Salon événement introuvable.' });
        return;
      }

      const nextType = (req.body?.type ?? existingParsed.type) as EventType;
      const nextMonth = req.body?.month !== undefined ? Number(req.body.month) : existingParsed.month;
      const nextDay = req.body?.day !== undefined ? Number(req.body.day) : existingParsed.day;
      const nextValue =
        typeof req.body?.value === 'string' ? req.body.value.trim() : undefined;

      if (nextType !== 'l' && nextType !== 'n' && nextType !== 'b' && nextType !== 'i') {
        res.status(400).json({ error: 'Type invalide.' });
        return;
      }
      if (!isValidDayForMonth(nextDay, nextMonth)) {
        res.status(400).json({ error: `Date invalide (${nextDay}/${nextMonth}).` });
        return;
      }

      if (nextValue !== undefined) {
        if (nextType === 'n') {
          if (!isValidServerName(nextValue)) {
            res.status(400).json({ error: t(cfg.locale, 'invalidServerName') });
            return;
          }
        } else if (!isSafeImageUrl(nextValue)) {
          res.status(400).json({ error: t(cfg.locale, 'invalidImageUrl') });
          return;
        }
      }

      const updated = await updateEventChannel(guild, channelId, {
        type: nextType,
        day: nextDay,
        month: nextMonth,
        value: nextValue,
      });

      if (!updated) {
        res.status(404).json({ error: 'Impossible de mettre à jour cet événement.' });
        return;
      }

      if (updated.conflict) {
        const conflictName = buildEventChannelName(nextType, nextDay, nextMonth);
        res.status(409).json({
          error: t(cfg.locale, 'editDateTypeConflict', { newName: conflictName }),
        });
        return;
      }

      await guild.channels.fetch().catch(() => null);
      res.json(await buildGuildDetailResponse(guild));
    }
  );

  // Delete event channel (/settings -> Supprimer)
  app.delete(
    '/api/dashboard/guilds/:guildId/events/:channelId',
    requireDiscordAuth,
    async (req: AuthenticatedRequest, res) => {
      const guild = await resolveAuthorizedBotGuild(req, res, getDiscordClient);
      if (!guild) return;

      const cfg = await getGuildConfig(guild);
      const perms = await checkBotGuildPermissions(guild, cfg.locale);
      if (!perms.ok) {
        res.status(403).json({ error: perms.embed.data.description ?? 'Permissions du bot manquantes.' });
        return;
      }

      const channelId = String(req.params.channelId ?? '').trim();
      if (!/^\d{15,22}$/.test(channelId)) {
        res.status(400).json({ error: 'Identifiant de salon invalide.' });
        return;
      }
      const deleted = await deleteEvent(guild, channelId);
      if (!deleted) {
        res.status(404).json({ error: 'Événement introuvable ou déjà supprimé.' });
        return;
      }

      await guild.channels.fetch().catch(() => null);
      res.json(await buildGuildDetailResponse(guild));
    }
  );

  // Export .txt (/settings -> Exporter)
  app.get(
    '/api/dashboard/guilds/:guildId/export',
    requireDiscordAuth,
    async (req: AuthenticatedRequest, res) => {
      const guild = await resolveAuthorizedBotGuild(req, res, getDiscordClient);
      if (!guild) return;

      const config = await getGuildConfig(guild);
      const events = await listEvents(guild);
      const createdAtIso = new Date().toISOString();

      const lines: string[] = [
        '# Logoto Export',
        `# Created-At: ${createdAtIso}`,
        `# Guild: ${guild.name} (${guild.id})`,
        '# Format: nom_du_salon:sujet_du_salon',
      ];

      if (config.logChannel) {
        const topic = formatConfigTopic(config.timezone, config.locale, {
          restoreRole: config.restoreRoleEnabled,
        });
        lines.push(`# Channel ${config.logChannel.name} | Created-At: ${config.logChannel.createdAt.toISOString()}`);
        lines.push(`${config.logChannel.name}:${topic}`);
      }

      for (const ev of events) {
        const chName = buildEventChannelName(ev.type, ev.day, ev.month);
        lines.push(`# Channel ${chName} | Created-At: ${ev.channel.createdAt.toISOString()}`);
        lines.push(`${chName}:${ev.value}`);
      }

      const fileDate = createdAtIso.slice(0, 10);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="logoto-export-${fileDate}.txt"`
      );
      res.send(lines.join('\n') + '\n');
    }
  );

  // Import .txt (/settings -> Importer)
  app.post(
    '/api/dashboard/guilds/:guildId/import',
    requireDiscordAuth,
    async (req: AuthenticatedRequest, res) => {
      const guild = await resolveAuthorizedBotGuild(req, res, getDiscordClient);
      if (!guild) return;

      const cfg = await getGuildConfig(guild);
      const perms = await checkBotGuildPermissions(guild, cfg.locale);
      if (!perms.ok) {
        res.status(403).json({ error: perms.embed.data.description ?? 'Permissions du bot manquantes.' });
        return;
      }

      const content = typeof req.body?.content === 'string' ? req.body.content : '';
      if (!content.trim() || Buffer.byteLength(content, 'utf8') > 512 * 1024) {
        res.status(400).json({ error: t(cfg.locale, 'importInvalidFile') });
        return;
      }

      const entries = parseImportEntries(content);
      if (entries.length === 0) {
        res.status(400).json({ error: t(cfg.locale, 'importInvalidFile') });
        return;
      }

      let created = 0;
      let updated = 0;
      let configUpdated = 0;
      let skipped = 0;

      for (const entry of entries) {
        if (entry.name.toLowerCase() === 'log-logoto') {
          const parsedCfg = parseConfigFromTopic(entry.topic);
          await setGuildConfig(guild, {
            timezone: parsedCfg.timezone,
            locale: parsedCfg.locale,
            restoreRole: parsedCfg.restoreRole,
          });
          if (parsedCfg.restoreRole) {
            await enableRestoreRole(guild).catch(() => {});
          }
          configUpdated += 1;
          continue;
        }

        const parsedEv = parseEventChannelName(entry.name);
        if (!parsedEv) {
          skipped += 1;
          continue;
        }

        if (parsedEv.type === 'n') {
          if (!isValidServerName(entry.topic)) {
            skipped += 1;
            continue;
          }
        } else if (!isSafeImageUrl(entry.topic)) {
          skipped += 1;
          continue;
        }

        const result = await upsertEvent(guild, {
          type: parsedEv.type,
          day: parsedEv.day,
          month: parsedEv.month,
          value: entry.topic,
        });
        if (result.created) {
          created += 1;
        } else {
          updated += 1;
        }
      }

      await guild.channels.fetch().catch(() => null);
      const detail = await buildGuildDetailResponse(guild);
      res.json({
        ...detail,
        importSummary: { created, updated, configUpdated, skipped },
      });
    }
  );

  // Direct image upload (to Discord #log-logoto or free third-party host)
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
  const rawImageParser = express.raw({
    type: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/octet-stream'],
    limit: MAX_UPLOAD_BYTES,
  });

  // Anti-spam protection for third-party hosts (ImgBB / sxcu.net) and Discord uploads
  type UploadProvider = 'thirdparty' | 'discord';
  const UPLOAD_LIMITS: Record<
    UploadProvider,
    { cooldownMs: number; burstWindowMs: number; burstMax: number; dailyWindowMs: number; dailyMax: number }
  > = {
    thirdparty: {
      cooldownMs: 12_000,
      burstWindowMs: 10 * 60_000,
      burstMax: 5,
      dailyWindowMs: 24 * 60 * 60_000,
      dailyMax: 25,
    },
    discord: {
      cooldownMs: 5_000,
      burstWindowMs: 10 * 60_000,
      burstMax: 12,
      dailyWindowMs: 24 * 60 * 60_000,
      dailyMax: 60,
    },
  };
  const GLOBAL_THIRDPARTY_HOURLY_MAX = 60;
  const GLOBAL_THIRDPARTY_DAILY_MAX = 250;
  const DEDUPE_TTL_MS = 24 * 60 * 60_000;
  const DEDUPE_MAX_ENTRIES = 300;
  const IMGBB_BACKOFF_MS = 10 * 60_000;

  const activeUploadsByUser = new Set<string>();
  const userUploadTimestamps = new Map<string, number[]>();
  let globalThirdPartyTimestamps: number[] = [];
  let imgbbBackoffUntil = 0;
  const thirdPartyDedupeCache = new Map<
    string,
    { url: string; hostName: string; expiresAt: number }
  >();

  function pruneOldTimestamps(list: number[], maxAgeMs: number, now: number): number[] {
    const cutoff = now - maxAgeMs;
    return list.filter((ts) => ts > cutoff);
  }

  function checkUploadRateLimit(
    userId: string,
    provider: UploadProvider
  ): { allowed: true } | { allowed: false; retryAfterSeconds: number; reason: 'inflight' | 'cooldown' | 'burst' | 'daily' | 'global' } {
    const now = Date.now();
    const userKey = `${userId}:${provider}`;

    if (activeUploadsByUser.has(userKey)) {
      return { allowed: false, retryAfterSeconds: 3, reason: 'inflight' };
    }

    const limits = UPLOAD_LIMITS[provider];
    const recent = pruneOldTimestamps(
      userUploadTimestamps.get(userKey) ?? [],
      limits.dailyWindowMs,
      now
    );
    if (recent.length > 0) {
      userUploadTimestamps.set(userKey, recent);
    } else {
      userUploadTimestamps.delete(userKey);
    }

    const lastUploadAt = recent[recent.length - 1];
    if (lastUploadAt && now - lastUploadAt < limits.cooldownMs) {
      const waitMs = limits.cooldownMs - (now - lastUploadAt);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
        reason: 'cooldown',
      };
    }

    const inBurstWindow = recent.filter((ts) => ts > now - limits.burstWindowMs);
    if (inBurstWindow.length >= limits.burstMax) {
      const waitMs = limits.burstWindowMs - (now - inBurstWindow[0]);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
        reason: 'burst',
      };
    }

    if (recent.length >= limits.dailyMax) {
      const waitMs = limits.dailyWindowMs - (now - recent[0]);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
        reason: 'daily',
      };
    }

    if (provider === 'thirdparty') {
      globalThirdPartyTimestamps = pruneOldTimestamps(
        globalThirdPartyTimestamps,
        24 * 60 * 60_000,
        now
      );
      const inHour = globalThirdPartyTimestamps.filter((ts) => ts > now - 60 * 60_000);
      if (inHour.length >= GLOBAL_THIRDPARTY_HOURLY_MAX) {
        const waitMs = 60 * 60_000 - (now - inHour[0]);
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
          reason: 'global',
        };
      }
      if (globalThirdPartyTimestamps.length >= GLOBAL_THIRDPARTY_DAILY_MAX) {
        const waitMs = 24 * 60 * 60_000 - (now - globalThirdPartyTimestamps[0]);
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
          reason: 'global',
        };
      }
    }

    return { allowed: true };
  }

  function recordUploadAttempt(userId: string, provider: UploadProvider): void {
    const now = Date.now();
    const userKey = `${userId}:${provider}`;
    const limits = UPLOAD_LIMITS[provider];
    const recent = pruneOldTimestamps(
      userUploadTimestamps.get(userKey) ?? [],
      limits.dailyWindowMs,
      now
    );
    recent.push(now);
    userUploadTimestamps.set(userKey, recent);

    if (provider === 'thirdparty') {
      globalThirdPartyTimestamps = pruneOldTimestamps(
        globalThirdPartyTimestamps,
        24 * 60 * 60_000,
        now
      );
      globalThirdPartyTimestamps.push(now);
    }
  }

  function cleanupUploadCaches(): void {
    const now = Date.now();
    for (const [k, expiresEntry] of thirdPartyDedupeCache.entries()) {
      if (expiresEntry.expiresAt <= now) {
        thirdPartyDedupeCache.delete(k);
      }
    }
    const maxWindow = 24 * 60 * 60_000;
    for (const [k, list] of userUploadTimestamps.entries()) {
      const kept = pruneOldTimestamps(list, maxWindow, now);
      if (kept.length === 0) {
        userUploadTimestamps.delete(k);
      } else {
        userUploadTimestamps.set(k, kept);
      }
    }
    globalThirdPartyTimestamps = pruneOldTimestamps(globalThirdPartyTimestamps, maxWindow, now);
  }
  setInterval(cleanupUploadCaches, 5 * 60_000).unref();

  function formatRateLimitMessage(
    locale: 'fr' | 'en',
    reason: 'inflight' | 'cooldown' | 'burst' | 'daily' | 'global',
    retryAfterSeconds: number
  ): string {
    if (locale === 'en') {
      if (reason === 'inflight') return 'Another upload is already in progress.';
      if (reason === 'global') {
        return `Free host upload quota temporarily reached. Please wait ${retryAfterSeconds}s or upload to Discord.`;
      }
      return `Upload limit reached to prevent spam. Please wait ${retryAfterSeconds}s before trying again.`;
    }
    if (reason === 'inflight') return 'Un envoi est déjà en cours. Patientez un instant.';
    if (reason === 'global') {
      return `Quota temporaire de l'hébergeur externe atteint. Patientez ${retryAfterSeconds} s ou utilisez Discord (#log-logoto).`;
    }
    return `Limite anti-spam atteinte. Veuillez patienter ${retryAfterSeconds} s avant d'envoyer une autre image.`;
  }

  function detectImageMagic(buf: Buffer): { ext: string; mime: string } | null {
    if (buf.length < 12) return null;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    ) {
      return { ext: 'png', mime: 'image/png' };
    }
    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return { ext: 'jpg', mime: 'image/jpeg' };
    }
    // GIF: GIF87a / GIF89a
    if (buf.subarray(0, 4).toString('ascii') === 'GIF8') {
      return { ext: 'gif', mime: 'image/gif' };
    }
    // WEBP: RIFF....WEBP
    if (
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { ext: 'webp', mime: 'image/webp' };
    }
    return null;
  }

  async function uploadToThirdPartyHost(
    buf: Buffer,
    filename: string,
    mime: string
  ): Promise<{ url: string; hostName: string }> {
    const imgbbKey = process.env.IMGBB_API_KEY?.trim();
    if (imgbbKey && Date.now() >= imgbbBackoffUntil) {
      try {
        const form = new FormData();
        form.append('key', imgbbKey);
        form.append('image', buf.toString('base64'));
        form.append('name', filename.replace(/\.[^.]+$/, ''));

        const resp = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(20_000),
        });
        if (resp.status === 429) {
          imgbbBackoffUntil = Date.now() + IMGBB_BACKOFF_MS;
        } else if (resp.ok) {
          const json = (await resp.json()) as {
            success?: boolean;
            data?: { image?: { url?: string }; url?: string };
          };
          const url = json.data?.image?.url || json.data?.url || '';
          if (json.success && isSafeImageUrl(url)) {
            return { url, hostName: 'ImgBB' };
          }
        } else if (resp.status === 400 || resp.status === 403) {
          const errText = (await resp.text().catch(() => '')).toLowerCase();
          if (
            errText.includes('rate') ||
            errText.includes('limit') ||
            errText.includes('flood') ||
            errText.includes('spam')
          ) {
            imgbbBackoffUntil = Date.now() + IMGBB_BACKOFF_MS;
          }
        }
      } catch {
        // Fall through to sxcu.net fallback
      }
    }

    // sxcu.net (free, permanent, no API key required)
    try {
      const sxcuForm = new FormData();
      sxcuForm.append('file', new Blob([new Uint8Array(buf)], { type: mime }), filename);
      sxcuForm.append('noembed', '1');

      const sxcuResp = await fetch('https://sxcu.net/api/files/create', {
        method: 'POST',
        headers: { 'User-Agent': 'LogotoBot/2.0' },
        body: sxcuForm,
        signal: AbortSignal.timeout(20_000),
      });
      if (sxcuResp.ok) {
        const sxcuJson = (await sxcuResp.json()) as { url?: string };
        const url = typeof sxcuJson.url === 'string' ? sxcuJson.url.trim() : '';
        if (isSafeImageUrl(url)) {
          return { url, hostName: 'sxcu.net' };
        }
      }
    } catch {
      // Fallback to Catbox / Freeimage.host
    }

    // Catbox.moe fallback (free, permanent, no API key required)
    try {
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', new Blob([new Uint8Array(buf)], { type: mime }), filename);

      const resp = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(20_000),
      });
      if (resp.ok) {
        const text = (await resp.text()).trim();
        if (isSafeImageUrl(text)) {
          return { url: text, hostName: 'Catbox' };
        }
      }
    } catch {
      // Fallback to Freeimage.host
    }

    // Optional Freeimage.host fallback if FREEIMAGE_API_KEY is configured
    const freeimageKey = process.env.FREEIMAGE_API_KEY?.trim();
    if (freeimageKey) {
      const freeForm = new FormData();
      freeForm.append('key', freeimageKey);
      freeForm.append('action', 'upload');
      freeForm.append('source', buf.toString('base64'));
      freeForm.append('format', 'json');

      const freeResp = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: freeForm,
        signal: AbortSignal.timeout(20_000),
      });
      if (freeResp.ok) {
        const freeJson = (await freeResp.json()) as {
          status_code?: number;
          image?: { url?: string };
        };
        const url = freeJson.image?.url || '';
        if (freeJson.status_code === 200 && isSafeImageUrl(url)) {
          return { url, hostName: 'Freeimage.host' };
        }
      }
    }

    throw new Error('Third-party image hosts are temporarily unavailable.');
  }

  function uploadRateLimitMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    const userId = req.discordSession?.user.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }
    const provider: UploadProvider = req.query.provider === 'discord' ? 'discord' : 'thirdparty';
    const reqLocale = req.query.locale === 'en' ? 'en' : 'fr';
    const check = checkUploadRateLimit(userId, provider);
    if (!check.allowed) {
      res.setHeader('Retry-After', String(check.retryAfterSeconds));
      res.status(429).json({
        error: formatRateLimitMessage(reqLocale, check.reason, check.retryAfterSeconds),
        retryAfterSeconds: check.retryAfterSeconds,
      });
      return;
    }
    next();
  }

  app.post(
    '/api/dashboard/upload-image',
    requireDiscordAuth,
    uploadRateLimitMiddleware,
    (req, res, next) => {
      rawImageParser(req, res, (err) => {
        if (err) {
          res.status(400).json({
            error: 'Fichier invalide ou trop volumineux (max 8 Mo, PNG/JPG/GIF/WEBP).',
          });
          return;
        }
        next();
      });
    },
    async (req: AuthenticatedRequest, res) => {
      const session = req.discordSession!;
      const provider: UploadProvider = req.query.provider === 'discord' ? 'discord' : 'thirdparty';
      const reqLocale = req.query.locale === 'en' ? 'en' : 'fr';
      const userKey = `${session.user.id}:${provider}`;

      // Re-check just before acquiring in-flight lock to block parallel race requests
      const recheck = checkUploadRateLimit(session.user.id, provider);
      if (!recheck.allowed) {
        res.setHeader('Retry-After', String(recheck.retryAfterSeconds));
        res.status(429).json({
          error: formatRateLimitMessage(reqLocale, recheck.reason, recheck.retryAfterSeconds),
          retryAfterSeconds: recheck.retryAfterSeconds,
        });
        return;
      }

      activeUploadsByUser.add(userKey);
      try {
        const buf = Buffer.isBuffer(req.body) ? req.body : null;
        if (!buf || buf.length === 0) {
          res.status(400).json({ error: 'Aucune donnée image reçue.' });
          return;
        }
        if (buf.length > MAX_UPLOAD_BYTES) {
          res.status(400).json({ error: 'Image trop volumineuse (max 8 Mo).' });
          return;
        }

        const detected = detectImageMagic(buf);
        if (!detected) {
          res.status(400).json({
            error: 'Format non supporté. Utilisez un fichier PNG, JPG, GIF ou WEBP.',
          });
          return;
        }

        const safeFilename = `logoto-${Date.now()}.${detected.ext}`;

        if (provider === 'discord') {
          const guildId = typeof req.query.guildId === 'string' ? req.query.guildId.trim() : '';
          if (!/^\d{15,22}$/.test(guildId)) {
            res.status(400).json({ error: 'Identifiant de serveur Discord manquant ou invalide.' });
            return;
          }

          await refreshSessionGuildsIfNeeded(session);
          if (!session.guilds.some((g) => g.id === guildId)) {
            res.status(403).json({
              error: 'Permissions insuffisantes sur ce serveur Discord.',
            });
            return;
          }

          const client = getDiscordClient();
          if (!client || !client.isReady()) {
            res.status(503).json({ error: 'Le bot Discord est actuellement hors ligne.' });
            return;
          }

          const guild =
            client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
          if (!guild) {
            res.status(404).json({ error: "Logoto n'est pas présent sur ce serveur." });
            return;
          }

          await guild.channels.fetch().catch(() => null);
          const cfg = await getGuildConfig(guild);
          if (!cfg.logChannel) {
            res.status(400).json({
              error:
                "Initialisez d'abord Logoto sur ce serveur (/setup) pour disposer du salon #log-logoto.",
            });
            return;
          }

          const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
          const perms = me ? cfg.logChannel.permissionsFor(me) : null;
          if (
            !perms?.has(PermissionsBitField.Flags.ViewChannel) ||
            !perms?.has(PermissionsBitField.Flags.SendMessages) ||
            !perms?.has(PermissionsBitField.Flags.AttachFiles)
          ) {
            res.status(403).json({
              error: 'Le bot n’a pas la permission Joindre des fichiers dans #log-logoto.',
            });
            return;
          }

          recordUploadAttempt(session.user.id, 'discord');
          try {
            const attachment = new AttachmentBuilder(buf, { name: safeFilename });
            const uploaderLabel = session.user.globalName
              ? `${session.user.globalName} (@${session.user.username})`
              : `@${session.user.username}`;
            const sent = await cfg.logChannel.send({
              content: `Image upload par ${uploaderLabel} depuis le dashboard`,
              files: [attachment],
              allowedMentions: { parse: [] },
            });
            const uploadedUrl = sent.attachments.first()?.url ?? '';
            if (!isSafeImageUrl(uploadedUrl)) {
              res.status(502).json({ error: 'Discord n’a pas renvoyé de lien valide.' });
              return;
            }

            res.json({
              url: uploadedUrl,
              provider: 'discord',
              hostName: `#${cfg.logChannel.name}`,
            });
            return;
          } catch (err) {
            console.error('[Logoto] Discord image upload error:', err);
            res.status(502).json({
              error: "Impossible d'envoyer l'image sur Discord.",
            });
            return;
          }
        }

        // SHA-256 deduplication avoids re-uploading identical files to ImgBB/sxcu.net
        const imageHash = createHash('sha256').update(buf).digest('hex');
        const cached = thirdPartyDedupeCache.get(imageHash);
        if (cached && cached.expiresAt > Date.now()) {
          res.json({
            url: cached.url,
            provider: 'thirdparty',
            hostName: cached.hostName,
            deduplicated: true,
          });
          return;
        }

        recordUploadAttempt(session.user.id, 'thirdparty');
        try {
          const result = await uploadToThirdPartyHost(buf, safeFilename, detected.mime);
          if (thirdPartyDedupeCache.size >= DEDUPE_MAX_ENTRIES) {
            const oldestKey = thirdPartyDedupeCache.keys().next().value;
            if (oldestKey) thirdPartyDedupeCache.delete(oldestKey);
          }
          thirdPartyDedupeCache.set(imageHash, {
            url: result.url,
            hostName: result.hostName,
            expiresAt: Date.now() + DEDUPE_TTL_MS,
          });
          res.json({
            url: result.url,
            provider: 'thirdparty',
            hostName: result.hostName,
          });
        } catch (err) {
          console.warn('[Logoto] Third-party image upload error:', err);
          res.status(502).json({
            error:
              "L'hébergeur tiers est momentanément indisponible. Vous pouvez utiliser l'envoi vers Discord.",
          });
        }
      } finally {
        activeUploadsByUser.delete(userKey);
      }
    }
  );
}
