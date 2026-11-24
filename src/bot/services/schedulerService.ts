import { ActivityType, EmbedBuilder, type Client, type Guild } from 'discord.js';
import { getEventTypeLabel, t } from '../i18n/index.js';
import { PRIMARY_COLOR, type EventRecord, type EventType, type GuildConfig, type SupportedLocale } from '../types.js';
import { formatLocalDateDisplay, isSafeImageUrl, isValidServerName } from '../utils/validators.js';
import { buildEventChannelName, listEvents } from './eventService.js';
import { getGuildConfig, getLocalDateParts, markGuildLastRunDate, sendLogEmbed } from './guildConfigService.js';

export const SCHEDULER_INTERVAL_MS = 60_000;
const HEALTH_REPORT_INTERVAL_MS = 180_000;
const QUEUE_STEP_DELAY_MS = 1_500;
const MAX_TRANSIENT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5 * 60_000;

const APPLIED_DISPLAY_ORDER: Record<EventType, number> = {
  n: 0,
  l: 1,
  b: 2,
  i: 3,
};

export const lastTriggeredByGuild = new Map<string, string>();
export const botStartedAtUnix = Math.floor(Date.now() / 1000);

const inFlightGuilds = new Set<string>();
const retryStateByGuild = new Map<string, { dateKey: string; attempts: number; nextRetryAt: number }>();

let intervalHandle: NodeJS.Timeout | null = null;
let queueChain: Promise<void> = Promise.resolve();
let cycleInProgress = false;
let lastHealthReportAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueueTask(task: () => Promise<void>): Promise<void> {
  const next = queueChain.then(async () => {
    try {
      await task();
    } catch (err) {
      console.error('[Logoto] Queued scheduler task error:', err);
    }
    await sleep(QUEUE_STEP_DELAY_MS);
  });
  queueChain = next.catch(() => {});
  return next;
}

function getAppliedLineLabel(locale: SupportedLocale, type: EventType): string {
  switch (type) {
    case 'n':
      return t(locale, 'logAppliedTypeName');
    case 'l':
      return t(locale, 'logAppliedTypeLogo');
    case 'b':
      return t(locale, 'logAppliedTypeBanner');
    case 'i':
      return t(locale, 'logAppliedTypeSplash');
  }
}

export function updateBotPresence(client: Client): void {
  if (!client.user) return;
  try {
    const guildCount = client.guilds.cache.size;
    let memberCount = 0;
    for (const guild of client.guilds.cache.values()) {
      memberCount += guild.memberCount ?? 0;
    }

    client.user.setPresence({
      activities: [
        {
          name: `${memberCount} members, ${guildCount} servers`,
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });
  } catch (err) {
    console.warn('[Logoto] Failed to update presence:', err);
  }
}

export async function reportAdminHealth(client: Client): Promise<void> {
  const pingChannelId = process.env.PING_CHANNEL_ID?.trim();
  if (!pingChannelId) return;

  try {
    const channel = await client.channels.fetch(pingChannelId);
    if (!channel || !channel.isTextBased() || !('send' in channel)) return;

    const ping = Math.max(0, Math.round(client.ws.ping));
    const guildCount = client.guilds.cache.size;

    await channel.send(
      `🏓 Ping : ${ping} ms | Serveurs : ${guildCount} | Démarré : <t:${botStartedAtUnix}:R>`
    );
  } catch (err) {
    console.warn('[Logoto] Could not send ping message to PING_CHANNEL_ID:', err);
  }
}

async function applyEventToGuild(
  guild: Guild,
  config: GuildConfig,
  event: EventRecord
): Promise<{ ok: boolean; retryable?: boolean; error?: string }> {
  const channelName = buildEventChannelName(event.type, event.day, event.month);
  const typeLabel = getEventTypeLabel(config.locale, event.type);
  const value = event.value.trim();
  let nonRetryable = false;

  try {
    if (!value) {
      nonRetryable = true;
      throw new Error('Empty channel topic value');
    }

    const reason = `Logoto scheduled event (${channelName} @ ${config.timezone})`;

    switch (event.type) {
      case 'l': {
        if (!isSafeImageUrl(value)) {
          nonRetryable = true;
          throw new Error('Invalid or unsafe HTTPS image URL for icon');
        }
        await guild.setIcon(value, reason);
        break;
      }
      case 'n': {
        if (!isValidServerName(value)) {
          nonRetryable = true;
          throw new Error('Server name must be between 2 and 100 characters');
        }
        await guild.setName(value, reason);
        break;
      }
      case 'b': {
        if (!isSafeImageUrl(value)) {
          nonRetryable = true;
          throw new Error('Invalid or unsafe HTTPS image URL for banner');
        }
        await guild.setBanner(value, reason);
        break;
      }
      case 'i': {
        if (!isSafeImageUrl(value)) {
          nonRetryable = true;
          throw new Error('Invalid or unsafe HTTPS image URL for invite splash');
        }
        await guild.setSplash(value, reason);
        break;
      }
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const discordCode =
      err && typeof err === 'object' && 'code' in err ? Number((err as { code: unknown }).code) : null;
    if (discordCode === 50013 || discordCode === 50035 || discordCode === 50001) {
      nonRetryable = true;
    }

    const errorEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(t(config.locale, 'logErrorTitle', { channelName }))
      .setDescription(
        `${t(config.locale, 'logErrorDesc', {
          type: typeLabel,
          value: value || '—',
          error: message.slice(0, 500),
        })}\n\n${t(config.locale, 'logErrorBoostHint')}`
      )
      .setTimestamp();

    await sendLogEmbed(guild, errorEmbed);
    return { ok: false, retryable: !nonRetryable, error: message };
  }
}

async function applyGuildDailyEvents(
  guild: Guild,
  config: GuildConfig,
  matching: EventRecord[]
): Promise<{ appliedCount: number; retryableErrors: number }> {
  const appliedEvents: EventRecord[] = [];
  let retryableErrors = 0;

  for (let idx = 0; idx < matching.length; idx++) {
    const event = matching[idx];
    const result = await applyEventToGuild(guild, config, event);
    if (result.ok) {
      appliedEvents.push(event);
    } else if (result.retryable) {
      retryableErrors += 1;
    }
    if (idx < matching.length - 1) {
      await sleep(QUEUE_STEP_DELAY_MS);
    }
  }

  if (appliedEvents.length > 0) {
    const sortedApplied = [...appliedEvents].sort(
      (a, b) => APPLIED_DISPLAY_ORDER[a.type] - APPLIED_DISPLAY_ORDER[b.type]
    );

    const lines = sortedApplied.map(
      (ev) => `• ${getAppliedLineLabel(config.locale, ev.type)} - <#${ev.channel.id}>`
    );

    const dateFooter = formatLocalDateDisplay(config.timezone, config.locale);

    const summaryEmbed = new EmbedBuilder()
      .setColor(PRIMARY_COLOR)
      .setTitle(t(config.locale, 'logAppliedTitle'))
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${dateFooter} • ${config.timezone}` });

    await sendLogEmbed(guild, summaryEmbed);
  }

  return { appliedCount: appliedEvents.length, retryableErrors };
}

export async function processDailyEvents(
  client: Client,
  options: { force?: boolean; guildId?: string } = {}
): Promise<{ checkedGuilds: number; queuedEvents: number; appliedEvents: number }> {
  let checkedGuilds = 0;
  let queuedEvents = 0;
  let appliedEvents = 0;

  const guilds = options.guildId
    ? ([client.guilds.cache.get(options.guildId)].filter(Boolean) as Guild[])
    : Array.from(client.guilds.cache.values());

  const tasks: Promise<void>[] = [];

  for (const guild of guilds) {
    try {
      const config = await getGuildConfig(guild);
      if (!config.logChannel) continue;

      checkedGuilds += 1;
      const { day, month, hour, dateKey } = getLocalDateParts(config.timezone);
      const lastRunDate = lastTriggeredByGuild.get(guild.id) ?? config.lastRunDate;

      if (!options.force) {
        if (lastRunDate === dateKey) {
          lastTriggeredByGuild.set(guild.id, dateKey);
          continue;
        }

        // Trigger at midnight hour, or catch up any time after midnight if a previous day's checkpoint exists
        const isDue = lastRunDate ? dateKey > lastRunDate : hour === 0;
        if (!isDue) {
          continue;
        }

        const retry = retryStateByGuild.get(guild.id);
        if (retry && retry.dateKey === dateKey && Date.now() < retry.nextRetryAt) {
          continue;
        }
      }

      if (inFlightGuilds.has(guild.id)) {
        continue;
      }

      const events = await listEvents(guild);
      const matching = events.filter((e) => e.day === day && e.month === month);

      if (matching.length === 0) {
        if (!options.force) {
          lastTriggeredByGuild.set(guild.id, dateKey);
          retryStateByGuild.delete(guild.id);
          await markGuildLastRunDate(guild, config, dateKey);
        }
        continue;
      }

      queuedEvents += matching.length;
      inFlightGuilds.add(guild.id);

      tasks.push(
        enqueueTask(async () => {
          try {
            const outcome = await applyGuildDailyEvents(guild, config, matching);
            appliedEvents += outcome.appliedCount;

            if (!options.force) {
              if (outcome.appliedCount > 0 || outcome.retryableErrors === 0) {
                lastTriggeredByGuild.set(guild.id, dateKey);
                retryStateByGuild.delete(guild.id);
                await markGuildLastRunDate(guild, config, dateKey);
              } else {
                const prev = retryStateByGuild.get(guild.id);
                const attempts = prev && prev.dateKey === dateKey ? prev.attempts + 1 : 1;
                if (attempts >= MAX_TRANSIENT_RETRIES) {
                  lastTriggeredByGuild.set(guild.id, dateKey);
                  retryStateByGuild.delete(guild.id);
                  await markGuildLastRunDate(guild, config, dateKey);
                } else {
                  retryStateByGuild.set(guild.id, {
                    dateKey,
                    attempts,
                    nextRetryAt: Date.now() + RETRY_BASE_DELAY_MS * attempts,
                  });
                }
              }
            }
          } finally {
            inFlightGuilds.delete(guild.id);
          }
        })
      );
    } catch (err) {
      console.error(`[Logoto] Error evaluating daily events for guild ${guild.id}:`, err);
    }
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }

  return { checkedGuilds, queuedEvents, appliedEvents };
}

export async function runScheduledCycle(client: Client): Promise<void> {
  if (cycleInProgress) return;
  cycleInProgress = true;
  try {
    updateBotPresence(client);
    const now = Date.now();
    if (now - lastHealthReportAt >= HEALTH_REPORT_INTERVAL_MS) {
      lastHealthReportAt = now;
      await reportAdminHealth(client);
    }
    await processDailyEvents(client);
  } catch (err) {
    console.error('[Logoto] Scheduled cycle error:', err);
  } finally {
    cycleInProgress = false;
  }
}

export function startScheduler(client: Client): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  updateBotPresence(client);
  lastHealthReportAt = Date.now();
  void runScheduledCycle(client);

  intervalHandle = setInterval(() => {
    void runScheduledCycle(client);
  }, SCHEDULER_INTERVAL_MS);
}

export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export async function drainScheduler(timeoutMs = 3000): Promise<void> {
  await Promise.race([queueChain.catch(() => {}), sleep(timeoutMs)]);
}
