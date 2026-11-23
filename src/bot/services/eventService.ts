import { ChannelType, PermissionsBitField, type Guild, type TextChannel } from 'discord.js';
import type { EventChannelParts, EventRecord, EventType, UpsertEventInput, UpsertEventResult } from '../types.js';
import { ensureLogotoCategory, findLogotoCategory } from './guildConfigService.js';

const EVENT_CHANNEL_REGEX = /^(l|n|b|i)-([1-9]|[12][0-9]|3[01])-([1-9]|1[0-2])$/;

const TYPE_SORT_ORDER: Record<EventType, number> = {
  l: 0,
  n: 1,
  b: 2,
  i: 3,
};

export function buildEventChannelName(type: EventType, day: number, month: number): string {
  const normalizedDay = Math.trunc(day);
  const normalizedMonth = Math.trunc(month);
  return `${type}-${normalizedDay}-${normalizedMonth}`;
}

export function parseEventChannelName(name: string): EventChannelParts | null {
  if (!name || typeof name !== 'string') return null;
  const match = EVENT_CHANNEL_REGEX.exec(name.trim().toLowerCase());
  if (!match) return null;

  const [, type, day, month] = match;
  return {
    type: type as EventType,
    day: Number(day),
    month: Number(month),
  };
}

export async function listEvents(guild: Guild): Promise<EventRecord[]> {
  const category = findLogotoCategory(guild);
  if (!category) return [];

  const events: EventRecord[] = [];

  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText) continue;
    if (channel.parentId !== category.id) continue;

    const parsed = parseEventChannelName(channel.name);
    if (!parsed) continue;

    events.push({
      channel,
      type: parsed.type,
      day: parsed.day,
      month: parsed.month,
      value: (channel.topic ?? '').trim(),
    });
  }

  events.sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    if (a.day !== b.day) return a.day - b.day;
    return TYPE_SORT_ORDER[a.type] - TYPE_SORT_ORDER[b.type];
  });

  return events;
}

export async function upsertEvent(
  guild: Guild,
  { type, day, month, value }: UpsertEventInput
): Promise<UpsertEventResult> {
  const category = await ensureLogotoCategory(guild);
  const channelName = buildEventChannelName(type, day, month);
  const cleanValue = value.trim();

  const existing = guild.channels.cache.find(
    (ch): ch is TextChannel =>
      ch.type === ChannelType.GuildText &&
      ch.parentId === category.id &&
      ch.name.toLowerCase() === channelName
  );

  if (existing) {
    await existing.setTopic(cleanValue, 'Logoto event value update');
    return { channel: existing, created: false };
  }

  const botId = guild.client.user?.id;
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    ...(botId
      ? [
          {
            id: botId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.EmbedLinks,
            ],
          },
        ]
      : []),
  ];

  const createdChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: cleanValue,
    permissionOverwrites,
    reason: `Logoto scheduled event ${channelName}`,
  });

  return { channel: createdChannel, created: true };
}

export async function updateEventChannel(
  guild: Guild,
  channelId: string,
  updates: { type?: EventType; day?: number; month?: number; value?: string }
): Promise<{ record: EventRecord; conflict?: boolean } | null> {
  const category = findLogotoCategory(guild);
  if (!category) return null;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText || channel.parentId !== category.id) {
    return null;
  }

  const parsed = parseEventChannelName(channel.name);
  if (!parsed) return null;

  const nextType = updates.type ?? parsed.type;
  const nextDay = updates.day ?? parsed.day;
  const nextMonth = updates.month ?? parsed.month;
  const nextName = buildEventChannelName(nextType, nextDay, nextMonth);

  if (nextName !== channel.name.toLowerCase()) {
    const duplicate = guild.channels.cache.find(
      (ch) =>
        ch.id !== channel.id &&
        ch.type === ChannelType.GuildText &&
        ch.parentId === category.id &&
        ch.name.toLowerCase() === nextName
    );
    if (duplicate) {
      return {
        record: {
          channel,
          type: parsed.type,
          day: parsed.day,
          month: parsed.month,
          value: (channel.topic ?? '').trim(),
        },
        conflict: true,
      };
    }

    await channel.setName(nextName, 'Logoto event schedule update');
  }

  let nextValue = (channel.topic ?? '').trim();
  if (updates.value !== undefined) {
    nextValue = updates.value.trim();
    await channel.setTopic(nextValue, 'Logoto event value update');
  }

  return {
    record: {
      channel,
      type: nextType,
      day: nextDay,
      month: nextMonth,
      value: nextValue,
    },
  };
}

export async function deleteEvent(guild: Guild, channelId: string): Promise<boolean> {
  try {
    const category = findLogotoCategory(guild);
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) return false;
    if (category && channel.parentId !== category.id) return false;
    if (!parseEventChannelName(channel.name)) return false;

    await channel.delete('Logoto event deleted');
    return true;
  } catch (err) {
    console.error(`[Logoto] Failed to delete event channel ${channelId} in guild ${guild.id}:`, err);
    return false;
  }
}
