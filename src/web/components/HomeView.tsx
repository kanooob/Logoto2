import { CheckCircle2, Cloud, Clock, RefreshCw, Settings, Zap } from 'lucide-react';
import { UI_COPY } from '../translations';
import type { BotStatsPayload, BotStatusPayload, DocSectionId, PageRoute, WebLocale } from '../types';

interface HomeViewProps {
  locale: WebLocale;
  inviteUrl: string;
  stats: BotStatsPayload | null;
  status: BotStatusPayload | null;
  statsLoading: boolean;
  onLocaleChange: (locale: WebLocale) => void;
  onNavigate: (route: PageRoute, hash?: string, docSection?: DocSectionId) => void;
}

const FEATURE_ICONS = [RefreshCw, Settings, Clock] as const;

export function HomeView({
  locale,
  inviteUrl,
  stats,
  status,
  statsLoading,
  onLocaleChange,
  onNavigate,
}: HomeViewProps) {
  const copy = UI_COPY[locale];
  const botService = status?.services?.[0];
  const isBotOnline = Boolean(stats?.online || botService?.status === 'operational');

  const serverCountText = (() => {
    if (statsLoading) return copy.hero.serversFallback;
    if (stats && stats.guildCount !== null && stats.guildCount > 0) {
      return `${copy.hero.serversPrefix} ${stats.guildCount} ${copy.hero.serversSuffix}`;
    }
    return copy.hero.serversFallback;
  })();

  const statusText = (() => {
    if (statsLoading) return '…';
    if (isBotOnline) {
      const pingPart =
        botService?.latencyMs !== null && botService?.latencyMs !== undefined
          ? ` · ${botService.latencyMs} ms`
          : '';
      return `${copy.hero.statusOnline}${pingPart}`;
    }
    return copy.hero.statusOffline;
  })();

  return (
    <main className="max-w-[1200px] mx-auto px-5 py-14 lg:py-[60px] flex flex-col items-center text-center animate-fade-in-up">
      {/* Centered Hero matching kanooob/logoto-web */}
      <section aria-labelledby="hero-title" className="max-w-[1000px] w-full mb-14 lg:mb-[60px]">
        <div className="flex justify-center mb-7">
          <div
            role="group"
            aria-label={locale === 'fr' ? 'Langue du site' : 'Site language'}
            className="inline-flex items-center p-0.5 rounded-lg bg-[#2f3136] border border-white/10"
          >
            <button
              type="button"
              onClick={() => onLocaleChange('fr')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                locale === 'fr'
                  ? 'bg-[#8c935d] text-[#F2F3F5]'
                  : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
              }`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => onLocaleChange('en')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                locale === 'en'
                  ? 'bg-[#8c935d] text-[#F2F3F5]'
                  : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <h1
          id="hero-title"
          className="font-display font-extrabold text-[#F2F3F5] leading-[1.2] tracking-[-0.5px] text-balance mb-6"
          style={{ fontSize: 'clamp(2rem, 4.2vw, 3rem)' }}
        >
          {copy.hero.titleLine1}
          <br />
          <span className="text-[#a3ab72]">{copy.hero.titleLine2}</span>
        </h1>

        <p className="text-base sm:text-[18px] text-[#F2F3F5]/85 leading-[1.6] max-w-[700px] mx-auto mb-10">
          {copy.hero.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 mb-10">
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-[#F2F3F5] font-bold text-lg transition-all duration-150 hover:-translate-y-0.5 shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a3ab72]"
          >
            {copy.hero.primaryCta}
          </a>
          <button
            type="button"
            onClick={() => onNavigate('docs', undefined, 'setup')}
            className="w-full sm:w-auto px-8 py-4 rounded-lg border-2 border-[#a3ab72] text-[#a3ab72] hover:bg-[#a3ab72] hover:text-[#36393f] font-bold text-lg transition-all duration-150 hover:-translate-y-0.5 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a3ab72]"
          >
            {copy.hero.secondaryCta}
          </button>
        </div>

        {/* Clean stacked telemetry rows matching kanooob/logoto-web */}
        <div className="flex flex-col items-center gap-3 text-sm font-semibold text-[#F2F3F5]/90 tabular-nums">
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-lg bg-[#8c935d]/10 border border-[#8c935d]/40">
            {isBotOnline ? (
              <Zap className="w-4 h-4 text-[#a3ab72] shrink-0" aria-hidden="true" />
            ) : (
              <Cloud className="w-4 h-4 text-[#b9bbbe] shrink-0" aria-hidden="true" />
            )}
            <span>{serverCountText}</span>
          </div>
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-lg bg-[#8c935d]/10 border border-[#8c935d]/40">
            {isBotOnline ? (
              <CheckCircle2 className="w-4 h-4 text-[#43b581] shrink-0" aria-hidden="true" />
            ) : (
              <Cloud className="w-4 h-4 text-[#f04747] shrink-0" aria-hidden="true" />
            )}
            <span>
              {copy.hero.statusLabel} : {statusText}
            </span>
          </div>
        </div>
      </section>

      {/* 3-Column Feature Cards matching kanooob/logoto-web */}
      <section aria-label={locale === 'fr' ? 'Fonctionnalités principales' : 'Core features'} className="w-full mt-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {copy.features.map((feature, idx) => {
            const Icon = FEATURE_ICONS[idx];
            return (
              <div
                key={feature.title}
                className="rounded-xl bg-[#2f3136] border border-white/5 hover:border-[#8c935d]/40 p-[30px] transition-all duration-200 hover:-translate-y-1"
              >
                <div className="mb-4 text-[#a3ab72]">
                  <Icon className="w-7 h-7" aria-hidden="true" />
                </div>
                <h2 className="font-display text-[20px] font-bold text-[#a3ab72] mb-3">
                  {feature.title}
                </h2>
                <p className="text-[15px] text-[#F2F3F5]/80 leading-[1.5]">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
