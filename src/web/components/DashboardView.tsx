import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { EventCategory, WebLocale } from '../types';
import {
  buildEventChannelName,
  COMMON_TIMEZONES,
  EVENT_TYPES,
  getEventTypeLabel,
  getMaxDaysInMonth,
  getMonthLabel,
  isSafeImageUrl,
  isValidDayForMonth,
  isValidServerName,
  normalizeTimeZone,
} from '../utils/logotoConfig';
import { ResilientImage } from './ResilientImage';

interface DashboardViewProps {
  locale: WebLocale;
  onLocaleChange: (locale: WebLocale) => void;
}

interface AuthConfig {
  oauthConfigured: boolean;
  botOnline: boolean;
  clientId: string;
  siteOrigin?: string;
  redirectUri: string;
}

interface DiscordUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
}

interface GuildSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  botPresent: boolean;
  configured: boolean;
  timezone: string | null;
  locale: WebLocale | null;
  premiumTier: number;
}

interface GuildEventItem {
  id: string;
  channelName: string;
  type: EventCategory;
  day: number;
  month: number;
  value: string;
  boostWarning: string | null;
}

interface GuildDetail {
  guild: {
    id: string;
    name: string;
    iconUrl: string | null;
    premiumTier: number;
  };
  configured: boolean;
  config: {
    timezone: string;
    locale: WebLocale;
    logChannelId: string | null;
    logChannelName: string | null;
    topic: string;
    localTime: string;
  };
  botPermissionsOk: boolean;
  botPermissionsError: string | null;
  events: GuildEventItem[];
  importSummary?: {
    created: number;
    updated: number;
    configUpdated: number;
    skipped: number;
  };
}

type ServerWorkspaceTab = 'events' | 'bot';
type GuildFilterMode = 'all' | 'configured' | 'unconfigured';

export function DashboardView({ locale }: DashboardViewProps) {
  const isFr = locale === 'fr';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auth state (Bearer token stored strictly in React memory, never localStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Guilds & Selected Guild state (starts null so server selection is shown alone first)
  const [guildsLoading, setGuildsLoading] = useState(false);
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [guildSearch, setGuildSearch] = useState('');
  const [guildFilter, setGuildFilter] = useState<GuildFilterMode>('all');
  const [botOnline, setBotOnline] = useState(false);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ServerWorkspaceTab>('events');

  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<GuildDetail | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Setup wizard form (for unconfigured servers)
  const [setupLocale, setSetupLocale] = useState<WebLocale>(locale);
  const [setupTz, setSetupTz] = useState<string>('Europe/Paris');

  // Config editors (/settings)
  const [customTzInput, setCustomTzInput] = useState<string>('UTC');
  const [copiedTopic, setCopiedTopic] = useState(false);

  // Event filters & CRUD form
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | EventCategory>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<EventCategory>('l');
  const [draftMonth, setDraftMonth] = useState<number>(12);
  const [draftDay, setDraftDay] = useState<string>('25');
  const [draftValue, setDraftValue] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const apiFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers ?? {});
      if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
      }
      if (init.method && init.method !== 'GET') {
        headers.set('X-Requested-With', 'LogotoDashboard');
        if (init.body && !headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      }
      return fetch(url, { ...init, headers, credentials: 'include' });
    },
    [authToken]
  );

  const loadGuilds = useCallback(
    async (tokenOverride?: string | null) => {
      setGuildsLoading(true);
      try {
        const headers = new Headers();
        const effectiveToken = tokenOverride !== undefined ? tokenOverride : authToken;
        if (effectiveToken) {
          headers.set('Authorization', `Bearer ${effectiveToken}`);
        }
        const res = await fetch('/api/dashboard/guilds', { headers, credentials: 'include' });
        if (res.status === 401) {
          setUser(null);
          setAuthToken(null);
          return;
        }
        if (!res.ok) throw new Error('Failed to load guilds');
        const data = (await res.json()) as { botOnline: boolean; guilds: GuildSummary[] };
        setBotOnline(data.botOnline);
        setGuilds(data.guilds);
        setSelectedGuildId((prev) => {
          if (prev && data.guilds.some((g) => g.id === prev)) return prev;
          return null;
        });
      } catch {
        setBannerMsg({
          kind: 'err',
          text: isFr
            ? 'Impossible de récupérer la liste de vos serveurs Discord.'
            : 'Unable to load your Discord servers.',
        });
      } finally {
        setGuildsLoading(false);
      }
    },
    [authToken, isFr]
  );

  const loadGuildDetail = useCallback(
    async (guildId: string) => {
      setDetailLoading(true);
      setDetail(null);
      setFormOpen(false);
      setConfirmDeleteId(null);
      try {
        const res = await apiFetch(`/api/dashboard/guilds/${encodeURIComponent(guildId)}`);
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string; botMissing?: boolean };
          if (!errData.botMissing) {
            setBannerMsg({
              kind: 'err',
              text: errData.error || (isFr ? 'Erreur lors du chargement du serveur.' : 'Failed to load server.'),
            });
          }
          return;
        }
        const data = (await res.json()) as GuildDetail;
        setDetail(data);
        setCustomTzInput(data.config.timezone);
      } catch {
        setBannerMsg({
          kind: 'err',
          text: isFr ? 'Erreur réseau lors du chargement du serveur.' : 'Network error loading server.',
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [apiFetch, isFr]
  );

  // Initial auth status check
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const originParam = encodeURIComponent(window.location.origin);
        const [cfgRes, meRes] = await Promise.all([
          fetch(`/api/auth/config?locale=${encodeURIComponent(locale)}&origin=${originParam}`, {
            credentials: 'include',
          }),
          fetch('/api/auth/me', { credentials: 'include' }),
        ]);
        if (!active) return;
        if (cfgRes.ok) {
          setAuthConfig((await cfgRes.json()) as AuthConfig);
        }
        if (meRes.ok) {
          const meData = (await meRes.json()) as { authenticated: boolean; user: DiscordUser | null };
          if (meData.authenticated && meData.user) {
            setUser(meData.user);
            await loadGuilds(null);
          }
        }
      } catch {
        // Ignore
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, [loadGuilds, locale]);

  // Listen for OAuth popup completion
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      const configuredOrigin = authConfig?.siteOrigin || '';
      const isAllowedOrigin =
        origin === window.location.origin ||
        (configuredOrigin && origin === configuredOrigin) ||
        origin.endsWith('.run.app') ||
        origin.includes('localhost');
      if (!isAllowedOrigin) return;

      if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setAuthError(isFr ? 'Connexion Discord annulée.' : 'Discord login cancelled.');
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const exchangeCode =
          typeof event.data?.exchangeCode === 'string' ? event.data.exchangeCode : '';
        try {
          if (exchangeCode) {
            const exRes = await fetch('/api/auth/exchange', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ exchangeCode }),
            });
            if (exRes.ok) {
              const exData = (await exRes.json()) as { token: string; user: DiscordUser };
              setAuthToken(exData.token);
              setUser(exData.user);
              setAuthError(null);
              setSelectedGuildId(null);
              await loadGuilds(exData.token);
              return;
            }
          }

          const meRes = await fetch('/api/auth/me', { credentials: 'include' });
          if (meRes.ok) {
            const meData = (await meRes.json()) as { authenticated: boolean; user: DiscordUser | null };
            if (meData.authenticated && meData.user) {
              setUser(meData.user);
              setAuthError(null);
              setSelectedGuildId(null);
              await loadGuilds(null);
            }
          }
        } catch {
          setAuthError(isFr ? 'Échec de validation de la session Discord.' : 'Failed to verify Discord session.');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [authConfig?.siteOrigin, isFr, loadGuilds]);

  const selectedGuildSummary = useMemo(
    () => guilds.find((g) => g.id === selectedGuildId) ?? null,
    [guilds, selectedGuildId]
  );

  useEffect(() => {
    if (user && selectedGuildSummary?.botPresent && botOnline) {
      void loadGuildDetail(selectedGuildSummary.id);
    } else {
      setDetail(null);
    }
  }, [user, selectedGuildSummary, botOnline, loadGuildDetail]);

  const handleSelectGuild = (guildId: string) => {
    setSelectedGuildId(guildId);
    setActiveTab('events');
    setBannerMsg(null);
    setSearchQuery('');
    setTypeFilter('all');
    setFormOpen(false);
    setConfirmDeleteId(null);
  };

  const handleBackToServers = () => {
    setSelectedGuildId(null);
    setDetail(null);
    setBannerMsg(null);
    setFormOpen(false);
    setConfirmDeleteId(null);
  };

  const handleDiscordLogin = async () => {
    setAuthError(null);
    try {
      const originParam = encodeURIComponent(window.location.origin);
      const res = await fetch(
        `/api/auth/discord/url?locale=${encodeURIComponent(locale)}&origin=${originParam}`,
        {
          credentials: 'include',
        }
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setAuthError(data.error || (isFr ? 'OAuth Discord indisponible.' : 'Discord OAuth unavailable.'));
        return;
      }

      const popup = window.open(data.url, 'discord_oauth', 'width=540,height=740');
      if (!popup) {
        setAuthError(
          isFr
            ? 'Popup bloquée par le navigateur. Autorisez les popups pour vous connecter avec Discord.'
            : 'Popup blocked by browser. Please allow popups to sign in with Discord.'
        );
      }
    } catch {
      setAuthError(isFr ? 'Impossible de démarrer la connexion Discord.' : 'Unable to start Discord login.');
    }
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthToken(null);
    setUser(null);
    setGuilds([]);
    setSelectedGuildId(null);
    setDetail(null);
    setBannerMsg(null);
  };

  const handleSetupGuild = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedGuildSummary) return;
    if (!normalizeTimeZone(setupTz)) {
      setBannerMsg({
        kind: 'err',
        text: isFr ? 'Fuseau horaire invalide.' : 'Invalid timezone.',
      });
      return;
    }

    setActionBusy(true);
    setBannerMsg(null);
    try {
      const res = await apiFetch(
        `/api/dashboard/guilds/${encodeURIComponent(selectedGuildSummary.id)}/setup`,
        {
          method: 'POST',
          body: JSON.stringify({ locale: setupLocale, timezone: setupTz }),
        }
      );
      const data = (await res.json()) as GuildDetail & { error?: string };
      if (!res.ok) {
        setBannerMsg({ kind: 'err', text: data.error || 'Setup failed' });
        return;
      }
      setDetail(data);
      setCustomTzInput(data.config.timezone);
      setGuilds((prev) =>
        prev.map((g) =>
          g.id === selectedGuildSummary.id
            ? { ...g, configured: true, timezone: data.config.timezone, locale: data.config.locale }
            : g
        )
      );
      setBannerMsg({
        kind: 'ok',
        text: isFr
          ? 'Logoto initialisé sur Discord (#log-logoto créé).'
          : 'Logoto initialized on Discord (#log-logoto created).',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleUpdateConfig = async (updates: { timezone?: string; locale?: WebLocale }) => {
    if (!detail) return;
    setActionBusy(true);
    setBannerMsg(null);
    try {
      const res = await apiFetch(
        `/api/dashboard/guilds/${encodeURIComponent(detail.guild.id)}/config`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );
      const data = (await res.json()) as GuildDetail & { error?: string };
      if (!res.ok) {
        setBannerMsg({ kind: 'err', text: data.error || 'Update failed' });
        return;
      }
      setDetail(data);
      setCustomTzInput(data.config.timezone);
      setGuilds((prev) =>
        prev.map((g) =>
          g.id === detail.guild.id
            ? { ...g, timezone: data.config.timezone, locale: data.config.locale }
            : g
        )
      );
      setBannerMsg({
        kind: 'ok',
        text: isFr ? 'Configuration du bot mise à jour.' : 'Bot configuration updated.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleCustomTzSubmit = (e: FormEvent) => {
    e.preventDefault();
    const norm = normalizeTimeZone(customTzInput);
    if (!norm) {
      setBannerMsg({
        kind: 'err',
        text: isFr
          ? 'Fuseau invalide. Exemple : Europe/Paris, America/Toronto, UTC+1.'
          : 'Invalid timezone. Example: Europe/Paris, America/Toronto, UTC+1.',
      });
      return;
    }
    void handleUpdateConfig({ timezone: norm });
  };

  const openCreateForm = () => {
    setEditingChannelId(null);
    setDraftType('l');
    setDraftMonth(12);
    setDraftDay('25');
    setDraftValue('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (ev: GuildEventItem) => {
    setEditingChannelId(ev.id);
    setDraftType(ev.type);
    setDraftMonth(ev.month);
    setDraftDay(String(ev.day));
    setDraftValue(ev.value);
    setFormError(null);
    setFormOpen(true);
  };

  const parsedDraftDay = /^\d{1,2}$/.test(draftDay.trim()) ? Number(draftDay.trim()) : NaN;
  const isDraftDateValid =
    Number.isInteger(parsedDraftDay) && isValidDayForMonth(parsedDraftDay, draftMonth);
  const previewChannelName = isDraftDateValid
    ? buildEventChannelName(draftType, parsedDraftDay, draftMonth)
    : `${draftType}-?-${draftMonth}`;

  const handleEventSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setFormError(null);

    if (!Number.isInteger(parsedDraftDay) || !isValidDayForMonth(parsedDraftDay, draftMonth)) {
      setFormError(
        isFr
          ? `Jour invalide pour ${getMonthLabel('fr', draftMonth)} (max ${getMaxDaysInMonth(draftMonth)}).`
          : `Invalid day for ${getMonthLabel('en', draftMonth)} (max ${getMaxDaysInMonth(draftMonth)}).`
      );
      return;
    }

    const cleanVal = draftValue.trim();
    if (draftType === 'n') {
      if (!isValidServerName(cleanVal)) {
        setFormError(
          isFr
            ? 'Le nom du serveur doit contenir entre 2 et 100 caractères.'
            : 'Server name must be between 2 and 100 characters.'
        );
        return;
      }
    } else if (!isSafeImageUrl(cleanVal)) {
      setFormError(
        isFr
          ? "L'URL doit commencer par https:// et pointer vers un domaine public valide."
          : 'URL must start with https:// and point to a valid public host.'
      );
      return;
    }

    setActionBusy(true);
    try {
      const endpoint = editingChannelId
        ? `/api/dashboard/guilds/${encodeURIComponent(detail.guild.id)}/events/${encodeURIComponent(editingChannelId)}`
        : `/api/dashboard/guilds/${encodeURIComponent(detail.guild.id)}/events`;
      const res = await apiFetch(endpoint, {
        method: editingChannelId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          type: draftType,
          month: draftMonth,
          day: parsedDraftDay,
          value: cleanVal,
        }),
      });
      const data = (await res.json()) as GuildDetail & { error?: string };
      if (!res.ok) {
        setFormError(data.error || 'Failed to save event');
        return;
      }
      setDetail(data);
      setFormOpen(false);
      setBannerMsg({
        kind: 'ok',
        text: isFr
          ? `Salon #${previewChannelName} enregistré sur Discord.`
          : `Channel #${previewChannelName} saved on Discord.`,
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteEvent = async (channelId: string) => {
    if (!detail) return;
    setActionBusy(true);
    try {
      const res = await apiFetch(
        `/api/dashboard/guilds/${encodeURIComponent(detail.guild.id)}/events/${encodeURIComponent(channelId)}`,
        { method: 'DELETE' }
      );
      const data = (await res.json()) as GuildDetail & { error?: string };
      if (!res.ok) {
        setBannerMsg({ kind: 'err', text: data.error || 'Delete failed' });
        return;
      }
      setDetail(data);
      setConfirmDeleteId(null);
      setBannerMsg({
        kind: 'ok',
        text: isFr ? 'Salon événement supprimé de Discord.' : 'Event channel deleted from Discord.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleExportTxt = async () => {
    if (!detail) return;
    const res = await apiFetch(`/api/dashboard/guilds/${encodeURIComponent(detail.guild.id)}/export`);
    if (!res.ok) {
      setBannerMsg({ kind: 'err', text: isFr ? 'Échec de l’export.' : 'Export failed.' });
      return;
    }
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logoto-export-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !detail) return;

    if (file.size > 512 * 1024) {
      setBannerMsg({
        kind: 'err',
        text: isFr ? 'Fichier trop volumineux (max 512 Ko).' : 'File too large (max 512 KB).',
      });
      return;
    }

    setActionBusy(true);
    try {
      const content = await file.text();
      const res = await apiFetch(
        `/api/dashboard/guilds/${encodeURIComponent(detail.guild.id)}/import`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        }
      );
      const data = (await res.json()) as GuildDetail & { error?: string };
      if (!res.ok) {
        setBannerMsg({ kind: 'err', text: data.error || 'Import failed' });
        return;
      }
      setDetail(data);
      if (data.importSummary) {
        const s = data.importSummary;
        setBannerMsg({
          kind: 'ok',
          text: isFr
            ? `Importation Discord terminée : ${s.created} créé(s), ${s.updated} mis à jour, ${s.configUpdated} config mise à jour, ${s.skipped} ignoré(s).`
            : `Discord import complete: ${s.created} created, ${s.updated} updated, ${s.configUpdated} config updated, ${s.skipped} skipped.`,
        });
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleCopyTopic = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.config.topic);
      setCopiedTopic(true);
      window.setTimeout(() => setCopiedTopic(false), 1800);
    } catch {
      // Ignore
    }
  };

  const filteredGuilds = useMemo(() => {
    const q = guildSearch.trim().toLowerCase();
    return guilds.filter((g) => {
      if (guildFilter === 'configured' && !(g.botPresent && g.configured)) return false;
      if (guildFilter === 'unconfigured' && g.botPresent && g.configured) return false;
      if (!q) return true;
      return g.name.toLowerCase().includes(q);
    });
  }, [guilds, guildSearch, guildFilter]);

  const filteredEvents = useMemo(() => {
    if (!detail) return [];
    const q = searchQuery.trim().toLowerCase();
    return detail.events.filter((ev) => {
      if (typeFilter !== 'all' && ev.type !== typeFilter) return false;
      if (!q) return true;
      return ev.channelName.includes(q) || ev.value.toLowerCase().includes(q);
    });
  }, [detail, searchQuery, typeFilter]);

  const botInviteForGuild = (guildId: string) => {
    const cid = authConfig?.clientId || '1431383390162124920';
    return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(cid)}&guild_id=${encodeURIComponent(guildId)}&permissions=536890416&scope=bot%20applications.commands`;
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-20 text-center text-[#b9bbbe] text-sm">
        {isFr ? 'Vérification de la session Discord…' : 'Checking Discord session…'}
      </div>
    );
  }

  // Unauthenticated Discord OAuth2 Screen (Clean, zero dev clutter)
  if (!user) {
    return (
      <div className="max-w-[600px] w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 animate-fade-in-up">
        <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-6 sm:p-10 space-y-6 text-center">
          <div className="space-y-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] tracking-tight text-balance">
              {isFr ? 'Dashboard Discord Logoto' : 'Logoto Discord Dashboard'}
            </h1>
            <p className="text-sm sm:text-base text-[#b9bbbe] leading-relaxed">
              {isFr
                ? 'Connectez-vous avec votre compte Discord pour initialiser Logoto et gérer vos événements en direct sur vos serveurs.'
                : 'Sign in with your Discord account to initialize Logoto and manage scheduled events live on your servers.'}
            </p>
          </div>

          {authError && (
            <div className="rounded-lg bg-[#f04747]/10 border border-[#f04747]/40 px-4 py-3 text-sm text-[#F2F3F5]">
              {authError}
            </div>
          )}

          {authConfig && !authConfig.oauthConfigured ? (
            <div className="rounded-lg bg-[#1e1f22] border border-white/10 px-4 py-3.5 text-sm text-[#b9bbbe]">
              {isFr
                ? 'La connexion Discord est momentanément indisponible. Réessayez plus tard.'
                : 'Discord sign-in is temporarily unavailable. Please try again later.'}
            </div>
          ) : (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDiscordLogin}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 h-12 px-7 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-base transition-colors cursor-pointer whitespace-nowrap"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028z" />
                </svg>
                <span>{isFr ? 'Se connecter avec Discord' : 'Sign in with Discord'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Reusable User & Account Bar (Uniform h-10 button sizing)
  const renderAccountBar = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
      <div className="flex items-center gap-3.5 min-w-0">
        {user.avatarUrl ? (
          <ResilientImage
            src={user.avatarUrl}
            alt={user.username}
            fallbackLabel={user.username.slice(0, 2).toUpperCase()}
            className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#8c935d]/25 border border-[#8c935d]/40 flex items-center justify-center font-bold text-sm text-[#a3ab72] shrink-0">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-lg sm:text-xl font-bold text-[#F2F3F5] truncate">
            {user.globalName || user.username}
          </h1>
          <p className="text-xs text-[#b9bbbe] font-mono truncate">@{user.username}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5">
        <button
          type="button"
          onClick={() => void loadGuilds()}
          disabled={guildsLoading}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 sm:min-w-[132px] rounded-lg bg-[#2b2d31] hover:bg-[#313338] border border-white/10 text-xs font-semibold text-[#F2F3F5] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${guildsLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isFr ? 'Actualiser' : 'Refresh'}</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 sm:min-w-[132px] rounded-lg bg-[#2b2d31] hover:bg-[#f04747]/15 border border-white/10 hover:border-[#f04747]/40 text-xs font-semibold text-[#F2F3F5] transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isFr ? 'Déconnexion' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );

  // =========================================================================
  // STEP 1: STANDALONE SERVER SELECTION SCREEN
  // =========================================================================
  if (!selectedGuildSummary) {
    return (
      <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6 animate-fade-in-up">
        {renderAccountBar()}

        {bannerMsg && (
          <div
            role="status"
            className={`flex items-center justify-between gap-4 px-4 py-3 rounded-lg border text-sm ${
              bannerMsg.kind === 'ok'
                ? 'bg-[#2b2d31] border-[#8c935d]/50 text-[#F2F3F5]'
                : 'bg-[#f04747]/10 border-[#f04747]/50 text-[#F2F3F5]'
            }`}
          >
            <span>{bannerMsg.text}</span>
            <button
              type="button"
              onClick={() => setBannerMsg(null)}
              aria-label={isFr ? 'Fermer' : 'Dismiss'}
              className="w-8 h-8 inline-flex items-center justify-center rounded text-[#b9bbbe] hover:text-[#F2F3F5] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!botOnline && (
          <div className="rounded-xl bg-[#2b2d31] border border-[#f04747]/40 px-4 py-3 text-sm text-[#F2F3F5] flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-[#f04747] shrink-0" aria-hidden="true" />
            <span>
              {isFr
                ? 'Le bot Discord est hors ligne côté serveur. Connectez le bot pour lire et modifier les salons en direct.'
                : 'The Discord bot is currently offline on the server. Connect the bot to read and edit Discord channels live.'}
            </span>
          </div>
        )}

        <section className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-[#F2F3F5] tracking-tight">
                {isFr ? 'Sélectionnez un serveur Discord' : 'Select a Discord Server'}
              </h2>
              <p className="text-sm text-[#b9bbbe] mt-1">
                {isFr
                  ? 'Choisissez le serveur que vous souhaitez initialiser ou configurer.'
                  : 'Choose the server you want to initialize or configure.'}
              </p>
            </div>

            {guilds.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div
                  role="tablist"
                  aria-label={isFr ? 'Filtrer les serveurs' : 'Filter servers'}
                  className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 rounded-lg bg-[#2b2d31] border border-white/10"
                >
                  {(
                    [
                      { id: 'all', label: isFr ? 'Tous' : 'All' },
                      { id: 'configured', label: isFr ? 'Configurés' : 'Configured' },
                      { id: 'unconfigured', label: isFr ? 'À préparer' : 'Setup' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={guildFilter === item.id}
                      onClick={() => setGuildFilter(item.id)}
                      className={`h-9 px-3.5 inline-flex items-center justify-center text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        guildFilter === item.id
                          ? 'bg-[#8c935d] text-[#F2F3F5]'
                          : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search
                    className="w-4 h-4 text-[#b9bbbe] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={guildSearch}
                    onChange={(e) => setGuildSearch(e.target.value)}
                    placeholder={isFr ? 'Rechercher un serveur…' : 'Search servers…'}
                    className="w-full h-11 pl-9 pr-3 rounded-lg bg-[#2b2d31] border border-white/10 text-sm text-[#F2F3F5] focus:border-[#a3ab72] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {guildsLoading && guilds.length === 0 ? (
            <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-12 text-center text-sm text-[#b9bbbe]">
              {isFr ? 'Chargement de vos serveurs Discord…' : 'Loading your Discord servers…'}
            </div>
          ) : guilds.length === 0 ? (
            <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-12 text-center text-sm text-[#b9bbbe]">
              {isFr
                ? 'Aucun serveur trouvé avec les permissions Administrateur ou Gérer le serveur.'
                : 'No servers found with Administrator or Manage Server permission.'}
            </div>
          ) : filteredGuilds.length === 0 ? (
            <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-12 text-center text-sm text-[#b9bbbe]">
              {isFr ? 'Aucun serveur ne correspond à votre recherche.' : 'No servers match your search.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGuilds.map((g) => {
                const statusSummary = g.botPresent
                  ? g.configured
                    ? `${g.timezone ?? 'UTC'} · ${(g.locale ?? 'en').toUpperCase()}`
                    : isFr
                      ? 'À initialiser (/setup)'
                      : 'Needs /setup'
                  : isFr
                    ? 'Bot non ajouté'
                    : 'Bot not added';

                const actionLabel = g.botPresent
                  ? g.configured
                    ? isFr
                      ? 'Gérer'
                      : 'Manage'
                    : isFr
                      ? 'Initialiser'
                      : 'Setup'
                  : isFr
                    ? 'Inviter'
                    : 'Invite';

                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectGuild(g.id)}
                    className="group text-left rounded-xl bg-[#2b2d31] border border-white/[0.08] hover:border-[#8c935d] p-4 sm:p-5 min-h-[84px] flex items-center justify-between gap-4 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {g.iconUrl ? (
                        <ResilientImage
                          src={g.iconUrl}
                          alt={g.name}
                          fallbackLabel={g.name.slice(0, 2).toUpperCase()}
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#1e1f22] border border-white/10 flex items-center justify-center text-sm font-bold text-[#a3ab72] shrink-0">
                          {g.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-display text-base font-bold text-[#F2F3F5] truncate group-hover:text-[#a3ab72] transition-colors">
                          {g.name}
                        </p>
                        <p className="text-xs text-[#b9bbbe] truncate mt-0.5 tabular-nums">
                          {statusSummary}
                        </p>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1 text-xs font-bold text-[#a3ab72] shrink-0">
                      <span>{actionLabel}</span>
                      <ChevronRight
                        className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  // =========================================================================
  // STEP 2: DEDICATED SELECTED SERVER WORKSPACE
  // =========================================================================
  return (
    <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6 animate-fade-in-up">
      {renderAccountBar()}

      {/* Server Contextual Header + Back to Server Selection */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl bg-[#2b2d31] border border-white/[0.08] p-4 sm:p-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={handleBackToServers}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#1e1f22] hover:bg-[#313338] border border-white/10 text-xs font-bold text-[#F2F3F5] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#a3ab72]" aria-hidden="true" />
            <span>{isFr ? 'Serveurs' : 'Servers'}</span>
          </button>

          <div className="flex items-center gap-3 min-w-0">
            {selectedGuildSummary.iconUrl ? (
              <ResilientImage
                src={selectedGuildSummary.iconUrl}
                alt={selectedGuildSummary.name}
                fallbackLabel={selectedGuildSummary.name.slice(0, 2).toUpperCase()}
                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#1e1f22] border border-white/10 flex items-center justify-center text-xs font-bold text-[#a3ab72] shrink-0">
                {selectedGuildSummary.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-extrabold text-[#F2F3F5] truncate">
                {selectedGuildSummary.name}
              </h2>
              {detail?.configured && (
                <p className="text-xs text-[#b9bbbe] tabular-nums truncate">
                  <span className="text-[#F2F3F5] font-medium">{detail.config.localTime}</span>
                  <span aria-hidden="true" className="mx-1.5">
                    ·
                  </span>
                  <span>{detail.config.timezone}</span>
                  <span aria-hidden="true" className="mx-1.5 hidden sm:inline">
                    ·
                  </span>
                  <span className="hidden sm:inline">
                    {isFr ? `Boost Niveau ${detail.guild.premiumTier}` : `Boost Level ${detail.guild.premiumTier}`}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Separated Bot Config vs Events Config Switcher (Uniform h-10 buttons) */}
        {detail?.configured && detail.botPermissionsOk && (
          <div
            role="tablist"
            aria-label={isFr ? 'Sections du serveur' : 'Server sections'}
            className="grid grid-cols-2 lg:inline-flex items-center gap-1 p-1 rounded-lg bg-[#1e1f22] border border-white/10 shrink-0 w-full lg:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'events'}
              onClick={() => setActiveTab('events')}
              className={`inline-flex items-center justify-center gap-2 h-10 px-4 lg:min-w-[155px] rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'events'
                  ? 'bg-[#8c935d] text-[#F2F3F5]'
                  : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isFr ? 'Événements' : 'Events'}{' '}
                <span className="font-mono tabular-nums opacity-85">({detail.events.length})</span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'bot'}
              onClick={() => {
                setActiveTab('bot');
                setFormOpen(false);
              }}
              className={`inline-flex items-center justify-center gap-2 h-10 px-4 lg:min-w-[155px] rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'bot'
                  ? 'bg-[#8c935d] text-[#F2F3F5]'
                  : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isFr ? 'Paramètres bot' : 'Bot Settings'}</span>
            </button>
          </div>
        )}
      </div>

      {bannerMsg && (
        <div
          role="status"
          className={`flex items-center justify-between gap-4 px-4 py-3 rounded-lg border text-sm ${
            bannerMsg.kind === 'ok'
              ? 'bg-[#2b2d31] border-[#8c935d]/50 text-[#F2F3F5]'
              : 'bg-[#f04747]/10 border-[#f04747]/50 text-[#F2F3F5]'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            aria-label={isFr ? 'Fermer' : 'Dismiss'}
            className="w-8 h-8 inline-flex items-center justify-center rounded text-[#b9bbbe] hover:text-[#F2F3F5] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!botOnline && (
        <div className="rounded-xl bg-[#2b2d31] border border-[#f04747]/40 px-4 py-3 text-sm text-[#F2F3F5] flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-[#f04747] shrink-0" aria-hidden="true" />
          <span>
            {isFr
              ? 'Le bot Discord est hors ligne côté serveur. Connectez le bot pour lire et modifier les salons en direct.'
              : 'The Discord bot is currently offline on the server. Connect the bot to read and edit Discord channels live.'}
          </span>
        </div>
      )}

      {!selectedGuildSummary.botPresent ? (
        <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-8 sm:p-12 text-center space-y-5">
          <Server className="w-10 h-10 text-[#a3ab72] mx-auto" aria-hidden="true" />
          <div className="space-y-2">
            <h3 className="font-display text-xl font-bold text-[#F2F3F5]">
              {selectedGuildSummary.name}
            </h3>
            <p className="text-sm text-[#b9bbbe] max-w-md mx-auto">
              {isFr
                ? "Logoto n'est pas encore présent sur ce serveur. Ajoutez-le puis cliquez sur Actualiser."
                : 'Logoto is not in this server yet. Invite the bot, then click Refresh.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={botInviteForGuild(selectedGuildSummary.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto sm:min-w-[200px] inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-sm font-bold text-[#F2F3F5] transition-colors whitespace-nowrap"
            >
              <span>{isFr ? 'Ajouter Logoto à ce serveur' : 'Add Logoto to this server'}</span>
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => void loadGuilds()}
              className="w-full sm:w-auto sm:min-w-[140px] inline-flex items-center justify-center h-11 px-5 rounded-lg bg-[#1e1f22] border border-white/15 text-sm font-semibold text-[#F2F3F5] cursor-pointer whitespace-nowrap"
            >
              {isFr ? 'Actualiser' : 'Refresh'}
            </button>
          </div>
        </div>
      ) : detailLoading || !detail ? (
        <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-12 text-center text-sm text-[#b9bbbe]">
          {isFr ? 'Chargement des salons Discord…' : 'Loading Discord channels…'}
        </div>
      ) : !detail.botPermissionsOk ? (
        <div className="rounded-xl bg-[#2b2d31] border border-[#f04747]/50 p-6 space-y-3">
          <h3 className="font-display text-lg font-bold text-[#f04747]">
            {isFr ? 'Permissions du bot manquantes' : 'Missing Bot Permissions'}
          </h3>
          <p className="text-sm text-[#F2F3F5]/85 whitespace-pre-line">{detail.botPermissionsError}</p>
        </div>
      ) : !detail.configured ? (
        /* Live /setup Flow */
        <form
          onSubmit={handleSetupGuild}
          className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-6 sm:p-8 space-y-6 max-w-2xl"
        >
          <div>
            <h3 className="font-display text-xl font-bold text-[#F2F3F5]">
              {isFr
                ? `Initialiser Logoto sur ${detail.guild.name} (/setup)`
                : `Initialize Logoto on ${detail.guild.name} (/setup)`}
            </h3>
            <p className="text-sm text-[#b9bbbe] mt-1">
              {isFr
                ? 'Crée la catégorie privée Logoto et le salon #log-logoto avec votre langue et votre fuseau horaire.'
                : 'Creates the private Logoto category and #log-logoto channel with your language and timezone.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="setup-lang" className="block text-xs font-semibold text-[#b9bbbe] mb-1.5">
                {isFr ? 'Langue du serveur' : 'Server language'}
              </label>
              <select
                id="setup-lang"
                value={setupLocale}
                onChange={(e) => setSetupLocale(e.target.value as WebLocale)}
                className="w-full h-11 px-3 rounded-lg bg-[#1e1f22] border border-white/10 text-sm text-[#F2F3F5]"
              >
                <option value="fr">Français (fr)</option>
                <option value="en">English (en)</option>
              </select>
            </div>

            <div>
              <label htmlFor="setup-tz" className="block text-xs font-semibold text-[#b9bbbe] mb-1.5">
                {isFr ? 'Fuseau horaire (IANA ou UTC±)' : 'Timezone (IANA or UTC±)'}
              </label>
              <input
                id="setup-tz"
                type="text"
                value={setupTz}
                onChange={(e) => setSetupTz(e.target.value)}
                list="common-tz-list"
                className="w-full h-11 px-3 rounded-lg bg-[#1e1f22] border border-white/10 text-sm font-mono text-[#F2F3F5]"
              />
              <datalist id="common-tz-list">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
            </div>
          </div>

          <button
            type="submit"
            disabled={actionBusy}
            className="w-full sm:w-auto sm:min-w-[180px] h-11 px-6 rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-sm font-bold text-[#F2F3F5] transition-colors cursor-pointer disabled:opacity-50"
          >
            {actionBusy
              ? isFr
                ? 'Configuration en cours…'
                : 'Configuring…'
              : isFr
                ? 'Initialiser (/setup)'
                : 'Initialize (/setup)'}
          </button>
        </form>
      ) : activeTab === 'bot' ? (
        /* =====================================================================
           TAB 2: BOT CONFIGURATION
           ===================================================================== */
        <div className="space-y-6">
          <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-5 sm:p-6 space-y-6">
            <div className="pb-4 border-b border-white/[0.08]">
              <h3 className="font-display text-lg font-bold text-[#F2F3F5]">
                {isFr ? 'Paramètres du bot sur ce serveur' : 'Bot Settings for this Server'}
              </h3>
              <p className="text-sm text-[#b9bbbe] mt-1">
                {isFr
                  ? 'Ces réglages sont stockés directement dans le sujet de #log-logoto sur Discord.'
                  : 'These settings are stored directly inside your #log-logoto channel topic on Discord.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-4 space-y-2">
                <label className="block text-xs font-semibold text-[#b9bbbe]">
                  {isFr ? 'Langue du bot' : 'Bot language'}
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#1e1f22] border border-white/10">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleUpdateConfig({ locale: 'fr' })}
                    className={`h-9 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      detail.config.locale === 'fr'
                        ? 'bg-[#8c935d] text-[#F2F3F5]'
                        : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
                    }`}
                  >
                    Français
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleUpdateConfig({ locale: 'en' })}
                    className={`h-9 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      detail.config.locale === 'en'
                        ? 'bg-[#8c935d] text-[#F2F3F5]'
                        : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div className="md:col-span-4 space-y-2">
                <label htmlFor="live-tz-select" className="block text-xs font-semibold text-[#b9bbbe]">
                  {isFr ? 'Fuseau rapide (IANA)' : 'Quick Timezone'}
                </label>
                <select
                  id="live-tz-select"
                  disabled={actionBusy}
                  value={COMMON_TIMEZONES.includes(detail.config.timezone) ? detail.config.timezone : ''}
                  onChange={(e) => void handleUpdateConfig({ timezone: e.target.value })}
                  className="w-full h-11 px-3 rounded-lg bg-[#1e1f22] border border-white/10 text-sm text-[#F2F3F5]"
                >
                  {!COMMON_TIMEZONES.includes(detail.config.timezone) && (
                    <option value="">{detail.config.timezone}</option>
                  )}
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleCustomTzSubmit} className="md:col-span-4 space-y-2">
                <label htmlFor="live-tz-custom" className="block text-xs font-semibold text-[#b9bbbe]">
                  {isFr ? 'Fuseau personnalisé' : 'Custom timezone'}
                </label>
                <div className="flex gap-2">
                  <input
                    id="live-tz-custom"
                    type="text"
                    value={customTzInput}
                    onChange={(e) => setCustomTzInput(e.target.value)}
                    className="flex-1 min-w-0 h-11 px-3 rounded-lg bg-[#1e1f22] border border-white/10 text-sm font-mono text-[#F2F3F5]"
                  />
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className="h-11 px-4 rounded-lg bg-[#313338] hover:bg-[#8c935d] border border-white/15 text-xs font-semibold text-[#F2F3F5] transition-colors cursor-pointer shrink-0"
                  >
                    OK
                  </button>
                </div>
              </form>
            </div>

            <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2 text-xs text-[#b9bbbe]">
                <span className="shrink-0">#log-logoto :</span>
                <code className="truncate font-mono text-[#a3ab72] bg-[#1e1f22] px-2.5 py-1 rounded">
                  {detail.config.topic}
                </code>
              </div>
              <button
                type="button"
                onClick={handleCopyTopic}
                aria-label={isFr ? 'Copier le sujet' : 'Copy topic'}
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg bg-[#1e1f22] border border-white/10 text-[#b9bbbe] hover:text-[#F2F3F5] cursor-pointer shrink-0"
              >
                {copiedTopic ? <Check className="w-4 h-4 text-[#43b581]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Backup & Restore (.txt) - Uniform button sizes */}
          <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-bold text-[#F2F3F5]">
                {isFr ? 'Sauvegarde & Importation (.txt)' : 'Backup & Restore (.txt)'}
              </h3>
              <p className="text-xs text-[#b9bbbe] mt-1">
                {isFr
                  ? 'Exportez ou restaurez la configuration complète (fuseau, langue et salons événements).'
                  : 'Export or restore your full server configuration (timezone, language, and event channels).'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json,text/plain"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={actionBusy}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 sm:min-w-[130px] rounded-lg bg-[#1e1f22] hover:bg-[#313338] border border-white/15 text-xs font-semibold text-[#F2F3F5] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-[#a3ab72]" aria-hidden="true" />
                <span>{isFr ? 'Importer' : 'Import'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleExportTxt()}
                disabled={actionBusy}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 sm:min-w-[130px] rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-xs font-bold text-[#F2F3F5] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isFr ? 'Exporter' : 'Export'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* =====================================================================
           TAB 1: SCHEDULED EVENTS CONFIGURATION (RESPONSIVE TABLE + MOBILE CARDS)
           ===================================================================== */
        <div className="space-y-6">
          {/* Events Toolbar */}
          <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-[#F2F3F5]">
                {isFr ? 'Événements programmés' : 'Scheduled Events'}{' '}
                <span className="font-mono text-sm text-[#a3ab72] tabular-nums">
                  ({detail.events.length})
                </span>
              </h3>
              <button
                type="button"
                onClick={openCreateForm}
                disabled={actionBusy}
                className="w-full sm:w-auto sm:min-w-[180px] inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-xs sm:text-sm font-bold text-[#F2F3F5] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{isFr ? 'Créer un événement' : 'Create event'}</span>
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
              <div className="relative flex-1 md:max-w-sm">
                <Search
                  className="w-4 h-4 text-[#b9bbbe] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isFr ? 'Rechercher un salon…' : 'Search channel…'}
                  className="w-full h-11 pl-9 pr-3 rounded-lg bg-[#1e1f22] border border-white/10 text-sm text-[#F2F3F5]"
                />
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#1e1f22] border border-white/10 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`h-9 px-3.5 inline-flex items-center justify-center text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                    typeFilter === 'all' ? 'bg-[#8c935d] text-[#F2F3F5]' : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
                  }`}
                >
                  {isFr ? 'Tous' : 'All'}
                </button>
                {EVENT_TYPES.map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setTypeFilter(tp)}
                    className={`h-9 px-3.5 inline-flex items-center justify-center text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                      typeFilter === tp ? 'bg-[#8c935d] text-[#F2F3F5]' : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
                    }`}
                  >
                    {tp === 'l'
                      ? 'Logo'
                      : tp === 'n'
                        ? isFr
                          ? 'Nom'
                          : 'Name'
                        : tp === 'b'
                          ? isFr
                            ? 'Bannière'
                            : 'Banner'
                          : 'Splash'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Create / Edit Event Form */}
          {formOpen && (
            <form
              onSubmit={handleEventSubmit}
              className="rounded-xl bg-[#2b2d31] border border-[#a3ab72]/60 p-5 sm:p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div>
                  <h4 className="font-display text-base font-bold text-[#F2F3F5]">
                    {editingChannelId
                      ? isFr
                        ? "Modifier l'événement Discord"
                        : 'Edit Discord Event'
                      : isFr
                        ? 'Créer un salon événement Discord'
                        : 'Create Discord Event Channel'}
                  </h4>
                  <p className="text-xs text-[#b9bbbe] mt-0.5">
                    {isFr ? 'Salon cible :' : 'Target channel:'}{' '}
                    <code className="font-mono text-[#a3ab72]">#{previewChannelName}</code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  aria-label={isFr ? 'Fermer le formulaire' : 'Close form'}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#b9bbbe] hover:text-[#F2F3F5] hover:bg-white/5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="live-ev-type" className="block text-xs font-semibold text-[#b9bbbe] mb-1.5">
                    1. Type
                  </label>
                  <select
                    id="live-ev-type"
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value as EventCategory)}
                    className="w-full h-11 px-3 rounded-lg bg-[#1e1f22] border border-white/10 text-sm text-[#F2F3F5]"
                  >
                    {EVENT_TYPES.map((tp) => (
                      <option key={tp} value={tp}>
                        {tp} — {getEventTypeLabel(locale, tp)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="live-ev-month" className="block text-xs font-semibold text-[#b9bbbe] mb-1.5">
                    {isFr ? '2. Mois' : '2. Month'}
                  </label>
                  <select
                    id="live-ev-month"
                    value={draftMonth}
                    onChange={(e) => setDraftMonth(Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-lg bg-[#1e1f22] border border-white/10 text-sm text-[#F2F3F5]"
                  >
                    {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                      <option key={m} value={m}>
                        {m} — {getMonthLabel(locale, m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="live-ev-day" className="block text-xs font-semibold text-[#b9bbbe] mb-1.5">
                    {isFr ? '3. Jour (1-31)' : '3. Day (1-31)'}
                  </label>
                  <input
                    id="live-ev-day"
                    type="number"
                    min={1}
                    max={31}
                    value={draftDay}
                    onChange={(e) => setDraftDay(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg bg-[#1e1f22] border border-white/10 text-sm font-mono text-[#F2F3F5] tabular-nums"
                  />
                </div>
              </div>

              {draftType === 'b' && detail.guild.premiumTier < 2 && (
                <p className="text-xs text-[#f0b232] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isFr
                      ? `Boost Niveau 2 requis pour les bannières (serveur actuellement au niveau ${detail.guild.premiumTier}).`
                      : `Boost Level 2 required for banners (server is currently Level ${detail.guild.premiumTier}).`}
                  </span>
                </p>
              )}
              {draftType === 'i' && detail.guild.premiumTier < 1 && (
                <p className="text-xs text-[#f0b232] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isFr
                      ? `Boost Niveau 1 requis pour les images d'invitation (serveur actuellement au niveau ${detail.guild.premiumTier}).`
                      : `Boost Level 1 required for invite splashes (server is currently Level ${detail.guild.premiumTier}).`}
                  </span>
                </p>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="live-ev-val" className="block text-xs font-semibold text-[#b9bbbe] mb-1.5">
                    {draftType === 'n'
                      ? isFr
                        ? '4. Nouveau nom du serveur (2 à 100 caractères)'
                        : '4. New server name (2 to 100 characters)'
                      : isFr
                        ? "4. URL HTTPS directe de l'image"
                        : '4. Direct HTTPS image URL'}
                  </label>
                  <input
                    id="live-ev-val"
                    type="text"
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    placeholder={draftType === 'n' ? 'Mon Serveur' : 'https://raw.githubusercontent.com/...'}
                    className="w-full h-11 px-3 rounded-lg bg-[#1e1f22] border border-white/10 text-sm text-[#F2F3F5]"
                  />
                </div>

                {/* Adapted Preview Container */}
                {draftType === 'n' ? (
                  <div className="rounded-lg bg-[#1e1f22] border border-white/[0.08] p-4 flex items-center gap-3.5">
                    {detail.guild.iconUrl ? (
                      <ResilientImage
                        src={detail.guild.iconUrl}
                        alt={detail.guild.name}
                        fallbackLabel={detail.guild.name.slice(0, 2).toUpperCase()}
                        className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/10"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[#2b2d31] border border-white/10 flex items-center justify-center text-xs font-bold text-[#a3ab72] shrink-0">
                        {detail.guild.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-[#b9bbbe]">
                        {isFr ? 'Aperçu du nom Discord' : 'Discord Name Preview'}
                      </p>
                      <p className="font-display text-base font-bold text-[#F2F3F5] truncate">
                        {draftValue.trim() || detail.guild.name}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#1e1f22] border border-white/[0.08] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#b9bbbe]">
                      <span className="font-semibold text-[#F2F3F5]">
                        {draftType === 'l'
                          ? isFr
                            ? 'Aperçu du logo (Carré 1:1)'
                            : 'Logo Preview (1:1 Square)'
                          : draftType === 'b'
                            ? isFr
                              ? 'Aperçu de la bannière (Rectangle 16:9)'
                              : 'Banner Preview (16:9 Rectangle)'
                            : isFr
                              ? "Aperçu de l'image d'invitation (Rectangle 16:9)"
                              : 'Invite Splash Preview (16:9 Rectangle)'}
                      </span>
                      <span className="font-mono text-[#a3ab72] tabular-nums">
                        {draftType === 'l'
                          ? '512 × 512 px'
                          : draftType === 'b'
                            ? '960 × 540 px'
                            : '1920 × 1080 px'}
                      </span>
                    </div>

                    {draftType === 'l' ? (
                      <div className="w-28 h-28 sm:w-32 sm:h-32 aspect-square rounded-2xl overflow-hidden border border-white/15 bg-[#23252a] flex items-center justify-center">
                        {isSafeImageUrl(draftValue) ? (
                          <ResilientImage
                            src={draftValue.trim()}
                            alt={previewChannelName}
                            fallbackLabel="1:1"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-[#b9bbbe]">
                            <ImageIcon className="w-6 h-6 text-[#a3ab72]/70" aria-hidden="true" />
                            <span className="font-mono text-[11px]">1:1</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full max-w-[360px] aspect-video rounded-xl overflow-hidden border border-white/15 bg-[#23252a] flex items-center justify-center">
                        {isSafeImageUrl(draftValue) ? (
                          <ResilientImage
                            src={draftValue.trim()}
                            alt={previewChannelName}
                            fallbackLabel="16:9"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-[#b9bbbe]">
                            <ImageIcon className="w-7 h-7 text-[#a3ab72]/70" aria-hidden="true" />
                            <span className="font-mono text-xs">16:9</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {formError && <p className="text-sm text-[#f04747]">{formError}</p>}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="w-full sm:w-auto sm:min-w-[160px] h-11 px-5 rounded-lg bg-[#1e1f22] border border-white/15 text-sm font-semibold text-[#F2F3F5] cursor-pointer whitespace-nowrap"
                >
                  {isFr ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="w-full sm:w-auto sm:min-w-[200px] h-11 px-5 rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-sm font-bold text-[#F2F3F5] cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {actionBusy
                    ? isFr
                      ? 'Enregistrement…'
                      : 'Saving…'
                    : isFr
                      ? 'Enregistrer sur Discord'
                      : 'Save to Discord'}
                </button>
              </div>
            </form>
          )}

          {/* Events List: Empty State / Desktop Table / Mobile Cards */}
          <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] overflow-hidden">
            {filteredEvents.length === 0 ? (
              <div className="p-10 text-center space-y-4">
                <p className="text-sm text-[#b9bbbe]">
                  {detail.events.length === 0
                    ? isFr
                      ? 'Aucun événement programmé sur ce serveur. Cliquez sur « Créer un événement » pour commencer.'
                      : 'No scheduled events on this server yet. Click "Create event" to get started.'
                    : isFr
                      ? 'Aucun événement ne correspond à votre filtre.'
                      : 'No events match your current filter.'}
                </p>
                {detail.events.length === 0 && (
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="h-11 px-5 rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-sm font-bold text-[#F2F3F5] cursor-pointer"
                  >
                    {isFr ? 'Créer un événement' : 'Create event'}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Card Layout (< md) - Uniform h-10 equal-width buttons */}
                <div className="md:hidden divide-y divide-white/[0.08]">
                  {filteredEvents.map((ev) => {
                    const isConfirming = confirmDeleteId === ev.id;
                    return (
                      <div key={ev.id} className="p-4 space-y-3">
                        <div className="flex items-start gap-3.5">
                          {ev.type === 'n' ? (
                            <div className="w-12 h-12 rounded-lg bg-[#1e1f22] border border-white/10 flex items-center justify-center text-xs font-bold text-[#a3ab72] shrink-0">
                              Aa
                            </div>
                          ) : ev.type === 'l' ? (
                            <div className="w-12 h-12 aspect-square rounded-lg overflow-hidden border border-white/10 bg-[#1e1f22] shrink-0">
                              <ResilientImage
                                src={ev.value}
                                alt={ev.channelName}
                                fallbackLabel="1:1"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-12 aspect-video rounded-md overflow-hidden border border-white/10 bg-[#1e1f22] shrink-0">
                              <ResilientImage
                                src={ev.value}
                                alt={ev.channelName}
                                fallbackLabel="16:9"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-[#a3ab72]">
                                #{ev.channelName}
                              </span>
                              <span className="text-xs text-[#b9bbbe] tabular-nums">
                                {ev.day} {getMonthLabel(locale, ev.month)}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-[#F2F3F5]">
                              {getEventTypeLabel(locale, ev.type)}
                            </p>
                            <p
                              title={ev.value}
                              className="font-mono text-xs text-[#b9bbbe] truncate"
                            >
                              {ev.value}
                            </p>
                          </div>
                        </div>

                        {isConfirming ? (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() => void handleDeleteEvent(ev.id)}
                              className="h-10 px-3 rounded-lg bg-[#f04747] text-xs font-semibold text-white cursor-pointer"
                            >
                              {isFr ? 'Confirmer' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-10 px-3 rounded-lg bg-[#1e1f22] border border-white/15 text-xs font-semibold text-[#F2F3F5] cursor-pointer"
                            >
                              {isFr ? 'Annuler' : 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openEditForm(ev)}
                              className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg bg-[#1e1f22] hover:bg-[#313338] border border-white/10 text-xs font-semibold text-[#F2F3F5] cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#a3ab72]" aria-hidden="true" />
                              <span>{isFr ? 'Modifier' : 'Edit'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(ev.id)}
                              className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg bg-[#1e1f22] hover:bg-[#f04747]/15 border border-white/10 text-xs font-semibold text-[#F2F3F5] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#f04747]" aria-hidden="true" />
                              <span>{isFr ? 'Supprimer' : 'Delete'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop High-Density Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] bg-[#1e1f22]/70 text-xs font-semibold text-[#b9bbbe]">
                        <th className="py-3 px-4">{isFr ? 'Aperçu' : 'Preview'}</th>
                        <th className="py-3 px-4">{isFr ? 'Salon' : 'Channel'}</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">{isFr ? 'Valeur' : 'Value'}</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] text-sm">
                      {filteredEvents.map((ev) => {
                        const isConfirming = confirmDeleteId === ev.id;
                        return (
                          <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-2.5 px-4">
                              {ev.type === 'n' ? (
                                <div className="w-10 h-10 rounded-lg bg-[#1e1f22] border border-white/10 flex items-center justify-center text-xs font-bold text-[#a3ab72]">
                                  Aa
                                </div>
                              ) : ev.type === 'l' ? (
                                <div className="w-10 h-10 aspect-square rounded-lg overflow-hidden border border-white/10 bg-[#1e1f22]">
                                  <ResilientImage
                                    src={ev.value}
                                    alt={ev.channelName}
                                    fallbackLabel="1:1"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-[72px] h-10 aspect-video rounded-md overflow-hidden border border-white/10 bg-[#1e1f22]">
                                  <ResilientImage
                                    src={ev.value}
                                    alt={ev.channelName}
                                    fallbackLabel="16:9"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-[#a3ab72] whitespace-nowrap">
                              #{ev.channelName}
                            </td>
                            <td className="py-3 px-4 text-[#F2F3F5]/90 whitespace-nowrap">
                              {getEventTypeLabel(locale, ev.type)}
                            </td>
                            <td className="py-3 px-4 text-[#b9bbbe] tabular-nums whitespace-nowrap">
                              {ev.day} {getMonthLabel(locale, ev.month)}
                            </td>
                            <td className="py-3 px-4 max-w-[260px]">
                              <span
                                title={ev.value}
                                className="block truncate font-mono text-xs text-[#F2F3F5]/85"
                              >
                                {ev.value}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {isConfirming ? (
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={actionBusy}
                                    onClick={() => void handleDeleteEvent(ev.id)}
                                    className="h-9 min-w-[84px] px-3 rounded bg-[#f04747] text-xs font-semibold text-white cursor-pointer"
                                  >
                                    {isFr ? 'Confirmer' : 'Confirm'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="h-9 min-w-[84px] px-3 rounded bg-[#1e1f22] border border-white/15 text-xs font-semibold text-[#F2F3F5] cursor-pointer"
                                  >
                                    {isFr ? 'Annuler' : 'Cancel'}
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditForm(ev)}
                                    aria-label={isFr ? `Modifier ${ev.channelName}` : `Edit ${ev.channelName}`}
                                    className="w-9 h-9 inline-flex items-center justify-center rounded-md text-[#b9bbbe] hover:text-[#F2F3F5] hover:bg-white/10 cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(ev.id)}
                                    aria-label={isFr ? `Supprimer ${ev.channelName}` : `Delete ${ev.channelName}`}
                                    className="w-9 h-9 inline-flex items-center justify-center rounded-md text-[#b9bbbe] hover:text-[#f04747] hover:bg-[#f04747]/10 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
