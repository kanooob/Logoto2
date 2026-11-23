import type { EventType, SupportedLocale } from '../types.js';

export interface SetupSession {
  locale: SupportedLocale;
  timezone?: string;
  updatedAt: number;
}

export interface SettingsDraftSession {
  mode: 'create' | 'editDateType';
  type?: EventType;
  month?: number;
  day?: number;
  targetChannelId?: string;
  page?: number;
  updatedAt: number;
}

const SESSION_TTL_MS = 15 * 60 * 1000;

const setupSessions = new Map<string, SetupSession>();
const settingsSessions = new Map<string, SettingsDraftSession>();

function keyFor(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [k, v] of setupSessions.entries()) {
    if (now - v.updatedAt > SESSION_TTL_MS) setupSessions.delete(k);
  }
  for (const [k, v] of settingsSessions.entries()) {
    if (now - v.updatedAt > SESSION_TTL_MS) settingsSessions.delete(k);
  }
}

export function getSetupSession(guildId: string, userId: string): SetupSession | null {
  pruneExpired();
  return setupSessions.get(keyFor(guildId, userId)) ?? null;
}

export function setSetupSession(guildId: string, userId: string, session: Omit<SetupSession, 'updatedAt'>): SetupSession {
  pruneExpired();
  const next: SetupSession = { ...session, updatedAt: Date.now() };
  setupSessions.set(keyFor(guildId, userId), next);
  return next;
}

export function clearSetupSession(guildId: string, userId: string): void {
  setupSessions.delete(keyFor(guildId, userId));
}

export function getSettingsSession(guildId: string, userId: string): SettingsDraftSession | null {
  pruneExpired();
  return settingsSessions.get(keyFor(guildId, userId)) ?? null;
}

export function setSettingsSession(
  guildId: string,
  userId: string,
  session: Omit<SettingsDraftSession, 'updatedAt'>
): SettingsDraftSession {
  pruneExpired();
  const next: SettingsDraftSession = { ...session, updatedAt: Date.now() };
  settingsSessions.set(keyFor(guildId, userId), next);
  return next;
}

export function clearSettingsSession(guildId: string, userId: string): void {
  settingsSessions.delete(keyFor(guildId, userId));
}
