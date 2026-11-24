export type WebLocale = 'fr' | 'en';

export type PageRoute = 'home' | 'dashboard' | 'docs' | 'legal';

export type DocSectionId =
  | 'setup'
  | 'how-it-works'
  | 'timezone'
  | 'commands'
  | 'events'
  | 'links';

export type EventCategory = 'l' | 'n' | 'b' | 'i';

export interface ScheduledEventItem {
  id: string;
  type: EventCategory;
  day: number;
  month: number;
  value: string;
}

export interface DashboardWorkspaceState {
  serverName: string;
  timezone: string;
  botLocale: WebLocale;
  events: ScheduledEventItem[];
}

export interface BotStatsPayload {
  server: string;
  guildCount: number | null;
  online: boolean;
  clientId: string;
  startedAtUnix: number;
}

export interface BotStatusPayload {
  success: boolean;
  discordReady: boolean;
  services: Array<{
    name: string;
    status: 'operational' | 'offline';
    latencyMs: number | null;
    startedAtUnix: number;
  }>;
  cachedAt: string;
}
