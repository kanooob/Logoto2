import { CheckCircle2, Cloud, Clock, Layers, RefreshCw } from 'lucide-react';
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

const FEATURE_ICONS = [RefreshCw, Layers, Clock] as const;

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
    <main className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24 flex flex-col items-center text-center">
      {/* Centered Hero matching logoto.onrender.com */}
      <section aria-labelledby="hero-title" className="max-w-[960px] w-full mb-14 lg:mb-16">
        <div className="flex justify-center mb-8">
          <div
            role="group"
            aria-label={locale === 'fr' ? 'Langue du site' : 'Site language'}
            className="inline-flex items-center p-0.5 rounded-lg bg-[#2f3136] border border-white/10"
          >
            <button
              type="button"
              onClick={() => onLocaleChange('fr')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
          className="font-display font-extrabold text-[#F2F3F5] leading-[1.18] tracking-tight text-balance mb-6"
          style={{ fontSize: 'clamp(2.15rem, 4vw, 3.15rem)' }}
        >
          {copy.hero.titleLine1}
          <br />
          <span className="text-[#a3ab72]">{copy.hero.titleLine2}</span>
        </h1>

        <p className="text-base sm:text-lg text-[#F2F3F5]/80 leading-relaxed max-w-[680px] mx-auto mb-10">
          {copy.hero.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 mb-10">
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-[#F2F3F5] font-bold text-base sm:text-lg transition-transform duration-150 hover:-translate-y-0.5 shadow-lg shadow-black/20 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a3ab72]"
          >
            {copy.hero.primaryCta}
          </a>
          <button
            type="button"
            onClick={() => onNavigate('docs', undefined, 'setup')}
            className="w-full sm:w-auto px-8 py-4 rounded-lg border-2 border-[#a3ab72] text-[#a3ab72] hover:bg-[#a3ab72] hover:text-[#2f3136] font-bold text-base sm:text-lg transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a3ab72]"
          >
            {copy.hero.secondaryCta}
          </button>
        </div>

        {/* Clean Metadata Strip (Server count + Live Bot status, unboxed inline text) */}
        <div className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-5 py-3 rounded-lg bg-[#2f3136] border border-[#8c935d]/30 text-sm text-[#F2F3F5]/85 tabular-nums">
          <span className="font-medium">{serverCountText}</span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span className="inline-flex items-center gap-2 font-medium">
            {isBotOnline ? (
              <CheckCircle2 className="w-4 h-4 text-[#43b581] shrink-0" aria-hidden="true" />
            ) : (
              <Cloud className="w-4 h-4 text-[#b9bbbe] shrink-0" aria-hidden="true" />
            )}
            <span>
              {copy.hero.statusLabel} : {statusText}
            </span>
          </span>
        </div>
      </section>

      {/* 3-Column Feature Cards matching logoto.onrender.com */}
      <section aria-label={locale === 'fr' ? 'Fonctionnalités principales' : 'Core features'} className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {copy.features.map((feature, idx) => {
            const Icon = FEATURE_ICONS[idx];
            return (
              <div
                key={feature.title}
                className="rounded-xl bg-[#2f3136] border border-white/8 hover:border-[#8c935d]/50 p-7 transition-colors duration-200"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-10 h-10 rounded-lg bg-[#8c935d]/15 border border-[#8c935d]/30 flex items-center justify-center text-[#a3ab72]">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-xs font-medium text-[#b9bbbe] tabular-nums">
                    {feature.num}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-[#a3ab72] mb-3">
                  {feature.title}
                </h2>
                <p className="text-[15px] text-[#F2F3F5]/80 leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
