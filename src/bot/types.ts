import type { CategoryChannel, TextChannel } from 'discord.js';

export const PRIMARY_COLOR = 0x8c935d;

export type SupportedLocale = 'fr' | 'en';

export type EventType = 'l' | 'n' | 'b' | 'i';

export interface GuildConfig {
  timezone: string;
  locale: SupportedLocale;
  category: CategoryChannel | null;
  logChannel: TextChannel | null;
  lastRunDate?: string;
  restoreRoleEnabled: boolean;
  restoreRoleId?: string | null;
  restoreRoleName?: string | null;
}

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateKey: string;
}

export interface EventChannelParts {
  type: EventType;
  day: number;
  month: number;
}

export interface EventRecord extends EventChannelParts {
  channel: TextChannel;
  value: string;
}

export interface UpsertEventInput {
  type: EventType;
  day: number;
  month: number;
  value: string;
}

export interface UpsertEventResult {
  channel: TextChannel;
  created: boolean;
}
