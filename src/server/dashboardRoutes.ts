import { EmbedBuilder, type Client, type Guild } from 'discord.js';
import type { Express, Response } from 'express';
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
  ensureLogChannel,
  formatConfigTopic,
  getGuildConfig,
  getLocalDateParts,
  isValidTimeZone,
  normalizeTimeZone,
  parseConfigFromTopic,
  setGuildConfig,
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

  await guild.channels.fetch().catch(() => null);
  return guild;
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
      topic: formatConfigTopic(config.timezone, config.locale),
      localTime: formatLocalDateTimeDisplay(config.timezone, config.locale),
    },
    botPermissionsOk: botPerms.ok,
    botPermissionsError: botPerms.ok ? null : botPerms.embed.data.description ?? null,
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

    if (created) {
      const topic = formatConfigTopic(updated.timezone, updated.locale);
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

  // Update timezone and/or language (/settings -> Fuseau horaire / Langue)
  app.patch('/api/dashboard/guilds/:guildId/config', requireDiscordAuth, async (req: AuthenticatedRequest, res) => {
    const guild = await resolveAuthorizedBotGuild(req, res, getDiscordClient);
    if (!guild) return;

    const current = await getGuildConfig(guild);
    const nextLocale: SupportedLocale =
      req.body?.locale === 'fr' || req.body?.locale === 'en' ? req.body.locale : current.locale;

    const perms = await checkBotGuildPermissions(guild, nextLocale);
    if (!perms.ok) {
      res.status(403).json({ error: perms.embed.data.description ?? 'Permissions du bot manquantes.' });
      return;
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

    await setGuildConfig(guild, {
      timezone: nextTz,
      locale: req.body?.locale ? nextLocale : undefined,
    });

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
        const topic = formatConfigTopic(config.timezone, config.locale);
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
          });
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
}
