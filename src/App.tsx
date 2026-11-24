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

function parseLocation(pathname: string): { locale: WebLocale; route: PageRoute } {
  const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const locale: WebLocale = clean.startsWith('/en') ? 'en' : 'fr';

  if (clean.endsWith('/dashboard') || clean.endsWith('/settings')) {
    return { locale, route: 'dashboard' };
  }
  if (clean.endsWith('/help')) {
    return { locale, route: 'docs' };
  }
  if (clean.endsWith('/legal')) {
    return { locale, route: 'legal' };
  }
  return { locale, route: 'home' };
}

function buildPath(locale: WebLocale, route: PageRoute, hash?: string): string {
  const base =
    route === 'dashboard'
      ? `/${locale}/dashboard`
      : route === 'docs'
        ? `/${locale}/help`
        : route === 'legal'
          ? `/${locale}/legal`
          : `/${locale}`;
  return hash ? `${base}${hash}` : base;
}

export default function App() {
  const initial = parseLocation(window.location.pathname);
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
    const onPopState = () => {
      const parsed = parseLocation(window.location.pathname);
      setLocale(parsed.locale);
      setRoute(parsed.route);
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
    const timer = window.setInterval(() => {
      void loadTelemetry();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
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
      const nextUrl = buildPath(nextLocale, route, window.location.hash || undefined);
      window.history.pushState(null, '', nextUrl);
    },
    [route]
  );

  const inviteUrl = buildInviteUrl(stats?.clientId);

  return (
    <div className="min-h-screen flex flex-col bg-[#36393f] text-[#F2F3F5]">
      <Header
        locale={locale}
        route={route}
        inviteUrl={inviteUrl}
        onNavigate={(target) => navigate(target)}
      />

      <div className={`flex-1 flex flex-col ${route === 'home' ? 'justify-center' : 'justify-start'}`}>
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
          <LegalView locale={locale} onLocaleChange={handleLocaleChange} />
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
