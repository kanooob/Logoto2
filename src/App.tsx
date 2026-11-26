import { useCallback, useEffect, useState } from 'react';
import { DashboardView } from './web/components/DashboardView';
import { DocsView } from './web/components/DocsView';
import { Footer } from './web/components/Footer';
import { Header } from './web/components/Header';
import { HomeView } from './web/components/HomeView';
import { LegalView } from './web/components/LegalView';
import { buildInviteUrl } from './web/translations';
import type {
  BotStatsPayload,
  BotStatusPayload,
  DocSectionId,
  PageRoute,
  WebLocale,
} from './web/types';

function parseLocation(
  pathname: string,
  hash?: string
): { locale: WebLocale; route: PageRoute; hash?: string } {
  const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const locale: WebLocale = clean === '/en' || clean.startsWith('/en/') ? 'en' : 'fr';

  if (clean.endsWith('/dashboard') || clean.endsWith('/settings')) {
    return { locale, route: 'dashboard' };
  }
  if (clean.endsWith('/docs') || clean.endsWith('/help')) {
    return { locale, route: 'docs' };
  }
  if (clean.endsWith('/cgu') || clean.endsWith('/tos') || clean.endsWith('/terms')) {
    return { locale, route: 'legal', hash: '#tos' };
  }
  if (clean.endsWith('/privacy') || clean.endsWith('/confidentialite')) {
    return { locale, route: 'legal', hash: '#privacy' };
  }
  if (clean.endsWith('/legal')) {
    return { locale, route: 'legal', hash: hash || undefined };
  }
  return { locale, route: 'home' };
}

function buildPath(locale: WebLocale, route: PageRoute, hash?: string): string {
  if (route === 'dashboard') {
    return `/${locale}/dashboard`;
  }
  if (route === 'docs') {
    return `/${locale}/docs`;
  }
  if (route === 'legal') {
    if (hash === '#privacy') return `/${locale}/privacy`;
    if (hash === '#tos') return `/${locale}/cgu`;
    return hash ? `/${locale}/legal${hash}` : `/${locale}/cgu`;
  }
  return `/${locale}`;
}

export default function App() {
  const initial = parseLocation(window.location.pathname, window.location.hash);
  const [locale, setLocale] = useState<WebLocale>(initial.locale);
  const [route, setRoute] = useState<PageRoute>(initial.route);
  const [docSection, setDocSection] = useState<DocSectionId>('setup');
  const [stats, setStats] = useState<BotStatsPayload | null>(null);
  const [status, setStatus] = useState<BotStatusPayload | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (initial.hash) {
      window.requestAnimationFrame(() => {
        const el = document.querySelector(initial.hash!);
        el?.scrollIntoView({ behavior: 'smooth' });
      });
    }
    // Run once on initial mount for deep links like /fr/privacy or /fr/cgu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseLocation(window.location.pathname, window.location.hash);
      setLocale(parsed.locale);
      setRoute(parsed.route);
      if (parsed.hash) {
        window.requestAnimationFrame(() => {
          const el = document.querySelector(parsed.hash!);
          el?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    const loadTelemetry = async () => {
      try {
        const [statsRes, statusRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/status'),
        ]);
        if (!active) return;
        if (statsRes.ok) {
          const statsData = (await statsRes.json()) as BotStatsPayload;
          setStats(statsData);
        }
        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as BotStatusPayload;
          setStatus(statusData);
        }
      } catch {
        // Keep graceful offline fallback
      } finally {
        if (active) setStatsLoading(false);
      }
    };

    void loadTelemetry();

    return () => {
      active = false;
    };
  }, []);

  const navigate = useCallback(
    (nextRoute: PageRoute, hash?: string, nextDocSection?: DocSectionId) => {
      setRoute(nextRoute);
      if (nextDocSection) {
        setDocSection(nextDocSection);
      }
      const nextUrl = buildPath(locale, nextRoute, hash);
      window.history.pushState(null, '', nextUrl);

      if (hash) {
        window.requestAnimationFrame(() => {
          const el = document.querySelector(hash);
          el?.scrollIntoView({ behavior: 'smooth' });
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [locale]
  );

  const handleLocaleChange = useCallback(
    (nextLocale: WebLocale) => {
      setLocale(nextLocale);
      const parsed = parseLocation(window.location.pathname, window.location.hash);
      const nextUrl = buildPath(nextLocale, route, parsed.hash);
      window.history.pushState(null, '', nextUrl);
    },
    [route]
  );

  const inviteUrl = buildInviteUrl(stats?.clientId);

  return (
    <div className="min-h-screen flex flex-col bg-[#23252a] text-[#F2F3F5]">
      <Header
        locale={locale}
        route={route}
        inviteUrl={inviteUrl}
        onLocaleChange={handleLocaleChange}
        onNavigate={(target) => navigate(target)}
      />

      <div className="flex-1 flex flex-col justify-start">
        {route === 'home' && (
          <HomeView
            locale={locale}
            inviteUrl={inviteUrl}
            stats={stats}
            status={status}
            statsLoading={statsLoading}
            onLocaleChange={handleLocaleChange}
            onNavigate={navigate}
          />
        )}
        {route === 'dashboard' && (
          <DashboardView locale={locale} onLocaleChange={handleLocaleChange} />
        )}
        {route === 'docs' && (
          <DocsView
            locale={locale}
            activeSection={docSection}
            onSelectSection={setDocSection}
            onLocaleChange={handleLocaleChange}
          />
        )}
        {route === 'legal' && (
          <LegalView
            locale={locale}
            onLocaleChange={handleLocaleChange}
            onSelectSection={(hash) => navigate('legal', hash)}
          />
        )}
      </div>

      <Footer
        locale={locale}
        onLocaleChange={handleLocaleChange}
        onNavigate={(target, hash) => navigate(target, hash)}
      />
    </div>
  );
}
