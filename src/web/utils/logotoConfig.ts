import type { DashboardWorkspaceState, EventCategory, ScheduledEventItem, WebLocale } from '../types';

export const COMMON_TIMEZONES: readonly string[] = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Toronto',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
] as const;

export const EVENT_TYPES: readonly EventCategory[] = ['l', 'n', 'b', 'i'] as const;

const TYPE_SORT_ORDER: Record<EventCategory, number> = {
  l: 0,
  n: 1,
  b: 2,
  i: 3,
};

const UTC_OFFSET_REGEX = /^(?:(?:utc|gmt)\s*)?([+-])\s*(\d{1,2})(?::(\d{2}))?$/i;
const EVENT_CHANNEL_REGEX = /^(l|n|b|i)-([1-9]|[12][0-9]|3[01])-([1-9]|1[0-2])$/;

const MONTH_NAMES: Record<WebLocale, readonly string[]> = {
  fr: [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

const TYPE_LABELS: Record<WebLocale, Record<EventCategory, string>> = {
  fr: {
    l: 'Logo (icône)',
    n: 'Nom du serveur',
    b: 'Bannière',
    i: "Image d'invitation",
  },
  en: {
    l: 'Logo (icon)',
    n: 'Server name',
    b: 'Banner',
    i: 'Invite splash',
  },
};

export function getMonthLabel(locale: WebLocale, month: number): string {
  return MONTH_NAMES[locale][month - 1] ?? String(month);
}

export function getEventTypeLabel(locale: WebLocale, type: EventCategory): string {
  return TYPE_LABELS[locale][type];
}

export function buildEventChannelName(type: EventCategory, day: number, month: number): string {
  return `${type}-${Math.trunc(day)}-${Math.trunc(month)}`;
}

export function getMaxDaysInMonth(month: number): number {
  switch (Math.trunc(month)) {
    case 2:
      return 29;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

export function isValidDayForMonth(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= getMaxDaysInMonth(month);
}

export function parseUtcOffsetMinutes(tz: string): number | null {
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

export function formatLocalDateTimeDisplay(
  timezone: string,
  locale: WebLocale,
  date: Date = new Date()
): string {
  const intlLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const normalized = normalizeTimeZone(timezone) ?? 'UTC';
  const offsetMinutes = parseUtcOffsetMinutes(normalized);

  if (offsetMinutes !== null) {
    const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(shifted);
  }

  try {
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: normalized,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
}

export function isValidServerName(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
}

export function isSafeImageUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 1000) return false;
  if (/[\s\\]/.test(trimmed)) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (!host || host === 'localhost') return false;
  if (
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return false;
  }
  if (!host.includes('.')) return false;
  return true;
}

export function sortEvents(events: ScheduledEventItem[]): ScheduledEventItem[] {
  return [...events].sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    if (a.day !== b.day) return a.day - b.day;
    return TYPE_SORT_ORDER[a.type] - TYPE_SORT_ORDER[b.type];
  });
}

export function buildLogotoExportText(state: DashboardWorkspaceState): string {
  const nowIso = new Date().toISOString();
  const lines: string[] = [
    '# Logoto Export',
    `# Created-At: ${nowIso}`,
    `# Guild: ${state.serverName.trim() || 'Mon Serveur'}`,
    '# Format: nom_du_salon:sujet_du_salon',
    `log-logoto:tz=${state.timezone};lang=${state.botLocale}`,
  ];

  for (const ev of sortEvents(state.events)) {
    const chName = buildEventChannelName(ev.type, ev.day, ev.month);
    lines.push(`${chName}:${ev.value.trim()}`);
  }

  return lines.join('\n') + '\n';
}

export interface ParsedImportOutcome {
  timezone?: string;
  botLocale?: WebLocale;
  events: Array<{ type: EventCategory; day: number; month: number; value: string }>;
  skipped: number;
}

export function parseLogotoImportText(rawText: string): ParsedImportOutcome {
  let timezone: string | undefined;
  let botLocale: WebLocale | undefined;
  const events: Array<{ type: EventCategory; day: number; month: number; value: string }> = [];
  let skipped = 0;

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) {
      skipped += 1;
      continue;
    }

    const name = line.slice(0, colonIdx).trim();
    const topic = line.slice(colonIdx + 1).trim();
    if (!name || !topic) {
      skipped += 1;
      continue;
    }

    if (name.toLowerCase() === 'log-logoto') {
      for (const seg of topic.split(';')) {
        const eq = seg.indexOf('=');
        if (eq === -1) continue;
        const k = seg.slice(0, eq).trim().toLowerCase();
        const v = seg.slice(eq + 1).trim();
        if (k === 'tz') {
          const norm = normalizeTimeZone(v);
          if (norm) timezone = norm;
        } else if (k === 'lang' && (v === 'fr' || v === 'en')) {
          botLocale = v;
        }
      }
      continue;
    }

    const match = EVENT_CHANNEL_REGEX.exec(name.toLowerCase());
    if (!match) {
      skipped += 1;
      continue;
    }

    const type = match[1] as EventCategory;
    const day = Number(match[2]);
    const month = Number(match[3]);
    if (!isValidDayForMonth(day, month)) {
      skipped += 1;
      continue;
    }

    if (type === 'n') {
      if (!isValidServerName(topic)) {
        skipped += 1;
        continue;
      }
    } else if (!isSafeImageUrl(topic)) {
      skipped += 1;
      continue;
    }

    events.push({ type, day, month, value: topic });
  }

  return { timezone, botLocale, events, skipped };
}
