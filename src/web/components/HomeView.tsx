import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Folder,
  Hash,
  LayoutDashboard,
  WifiOff,
} from 'lucide-react';
import { ASSETS, UI_COPY } from '../translations';
import type { BotStatsPayload, BotStatusPayload, DocSectionId, PageRoute, WebLocale } from '../types';
import { ResilientImage } from './ResilientImage';

interface HomeViewProps {
  locale: WebLocale;
  inviteUrl: string;
  stats: BotStatsPayload | null;
  status: BotStatusPayload | null;
  statsLoading: boolean;
  onLocaleChange: (locale: WebLocale) => void;
  onNavigate: (route: PageRoute, hash?: string, docSection?: DocSectionId) => void;
}

export function HomeView({
  locale,
  inviteUrl,
  stats,
  status,
  statsLoading,
  onNavigate,
}: HomeViewProps) {
  const copy = UI_COPY[locale];
  const [activePresetIdx, setActivePresetIdx] = useState(0);

  const botService = status?.services?.[0];
  const isBotOnline = Boolean(stats?.online || botService?.status === 'operational');

  const serverCountLabel = (() => {
    if (statsLoading) return copy.hero.serversFallback;
    if (stats && stats.guildCount !== null && stats.guildCount > 0) {
      return `${stats.guildCount} ${copy.hero.serversSuffix}`;
    }
    return copy.hero.serversFallback;
  })();

  const statusLabel = (() => {
    if (statsLoading) return '…';
    if (isBotOnline) {
      const ping =
        botService?.latencyMs !== null && botService?.latencyMs !== undefined
          ? ` · ${botService.latencyMs} ms`
          : '';
      return `${copy.hero.statusOnline}${ping}`;
    }
    return copy.hero.statusOffline;
  })();

  const presets = copy.preview.presets;
  const activePreset = presets[activePresetIdx] ?? presets[0];

  const previewBannerSrc =
    activePreset.id === 'autumn'
      ? ASSETS.autumnBanner
      : activePreset.id === 'winter'
        ? ASSETS.winterBanner
        : ASSETS.eventBanner;

  const previewIconSrc =
    activePreset.id === 'winter'
      ? ASSETS.winterBanner
      : activePreset.id === 'event'
        ? ASSETS.eventBanner
        : ASSETS.emblem;

  const isFr = locale === 'fr';

  return (
    <main className="w-full animate-fade-in-up">
      {/* ===================================================================
          HERO SECTION: 12-Col Asymmetric Split (Desktop) / Clean Stack (Mobile)
         =================================================================== */}
      <section
        aria-labelledby="hero-title"
        className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 pt-10 pb-14 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Value Proposition & Primary Action */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <h1
              id="hero-title"
              className="font-display font-extrabold text-[#F2F3F5] leading-[1.12] tracking-tight text-balance"
              style={{ fontSize: 'clamp(2.15rem, 4.1vw, 3.35rem)' }}
            >
              {copy.hero.titleLine1}{' '}
              <span className="text-[#a3ab72]">{copy.hero.titleLine2}</span>
            </h1>

            <p className="text-base sm:text-lg text-[#b9bbbe] leading-relaxed max-w-2xl">
              {copy.hero.subtitle}
            </p>

            {/* Primary CTA + Secondary Workspace Link */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 pt-1">
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 min-h-[48px] px-7 py-3 rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-[#F2F3F5] font-bold text-base transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a3ab72]"
              >
                <span>{copy.hero.primaryCta}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-lg bg-[#2b2d31] hover:bg-[#313338] border border-white/12 text-[#F2F3F5] font-semibold text-base transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a3ab72]"
              >
                <LayoutDashboard className="w-4 h-4 text-[#a3ab72]" aria-hidden="true" />
                <span>{copy.hero.secondaryCta}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('docs', undefined, 'setup')}
                className="inline-flex items-center justify-center min-h-[44px] px-3 text-sm font-semibold text-[#a3ab72] hover:text-[#F2F3F5] underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copy.hero.docsLink}
              </button>
            </div>

            {/* Quiet Unboxed Telemetry Strip */}
            <div className="pt-5 border-t border-white/[0.08] flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs sm:text-sm text-[#b9bbbe] tabular-nums">
              <div className="inline-flex items-center gap-2">
                {isBotOnline ? (
                  <CheckCircle2 className="w-4 h-4 text-[#43b581] shrink-0" aria-hidden="true" />
                ) : (
                  <WifiOff className="w-4 h-4 text-[#f04747] shrink-0" aria-hidden="true" />
                )}
                <span className="text-[#F2F3F5] font-medium">
                  {copy.hero.statusLabel} : {statusLabel}
                </span>
              </div>
              <span aria-hidden="true" className="text-white/25">
                ·
              </span>
              <span>{serverCountLabel}</span>
            </div>
          </div>

          {/* Right Column: Interactive Discord Identity Switcher Showcase */}
          <div className="lg:col-span-5">
            <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] overflow-hidden">
              {/* Interactive Date Selector Header */}
              <div className="px-4 py-3.5 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1e1f22]/60">
                <div>
                  <p className="text-xs font-semibold text-[#F2F3F5]">{copy.preview.heading}</p>
                  <p className="text-xs text-[#b9bbbe]">{copy.preview.subheading}</p>
                </div>

                <div
                  role="tablist"
                  aria-label={isFr ? 'Simuler une date' : 'Simulate a scheduled date'}
                  className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#23252a] border border-white/[0.08] self-start sm:self-auto"
                >
                  {presets.map((preset, idx) => {
                    const active = idx === activePresetIdx;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActivePresetIdx(idx)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                          active
                            ? 'bg-[#8c935d] text-[#F2F3F5]'
                            : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
                        }`}
                      >
                        {preset.tab}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Simulated Discord Server Banner + Icon */}
              <div className="relative aspect-video w-full bg-[#1e1f22] overflow-hidden">
                <ResilientImage
                  src={previewBannerSrc}
                  alt={activePreset.serverName}
                  fallbackLabel="16:9"
                  className="w-full h-full object-cover transition-opacity duration-200"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#2b2d31] via-[#2b2d31]/25 to-transparent"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[#1e1f22]/90 border border-white/10 font-mono text-xs text-[#a3ab72]">
                  {activePreset.channel}
                </div>
              </div>

              {/* Server Identity Row + #log-logoto Execution Preview */}
              <div className="px-5 pb-5 -mt-7 relative z-10 space-y-4">
                <div className="flex items-end gap-3.5">
                  <div className="w-16 h-16 aspect-square rounded-2xl overflow-hidden border-4 border-[#2b2d31] bg-[#1e1f22] shrink-0">
                    <ResilientImage
                      src={previewIconSrc}
                      alt={activePreset.season}
                      fallbackLabel="1:1"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 pb-1">
                    <h2 className="font-display text-base sm:text-lg font-bold text-[#F2F3F5] truncate">
                      {activePreset.serverName}
                    </h2>
                    <p className="text-xs text-[#b9bbbe] tabular-nums">
                      {activePreset.tab} · {activePreset.season}
                    </p>
                  </div>
                </div>

                {/* Simulated Log Entry */}
                <div className="rounded-lg bg-[#1e1f22] border border-white/[0.06] px-3.5 py-2.5 flex items-start gap-2.5 text-xs">
                  <Hash className="w-3.5 h-3.5 text-[#a3ab72] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <span className="font-mono text-[#a3ab72] font-semibold">
                      {copy.preview.logChannel}
                    </span>
                    <p className="text-[#b9bbbe] mt-0.5 leading-relaxed">
                      {activePreset.actionSummary}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          SECTION 2: ASYMMETRIC BENTO ARCHITECTURE GRID
         =================================================================== */}
      <section
        aria-labelledby="bento-heading"
        className="border-t border-white/[0.08] bg-[#1e1f22]/55"
      >
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20 space-y-10">
          <div className="max-w-2xl space-y-3">
            <h2
              id="bento-heading"
              className="font-display font-extrabold text-[#F2F3F5] tracking-tight text-balance"
              style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)' }}
            >
              {copy.bento.sectionTitle}
            </h2>
            <p className="text-sm sm:text-base text-[#b9bbbe] leading-relaxed">
              {copy.bento.sectionSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 01. Native Discord Storage (7 cols) */}
            <article className="lg:col-span-7 rounded-xl bg-[#2b2d31] border border-white/[0.08] p-6 sm:p-7 flex flex-col justify-between gap-6">
              <div className="space-y-2.5">
                <h3 className="font-display text-lg sm:text-xl font-bold text-[#F2F3F5]">
                  {copy.bento.cards.nativeTitle}
                </h3>
                <p className="text-sm sm:text-[15px] text-[#b9bbbe] leading-relaxed">
                  {copy.bento.cards.nativeDesc}
                </p>
              </div>

              {/* Clean Discord Category Hierarchy Visual */}
              <div className="rounded-lg bg-[#1e1f22] border border-white/[0.06] p-4 font-mono text-xs sm:text-[13px] space-y-2">
                <div className="flex items-center gap-2 text-[#b9bbbe] font-semibold">
                  <Folder className="w-3.5 h-3.5 text-[#a3ab72] shrink-0" aria-hidden="true" />
                  <span>LOGOTO</span>
                </div>
                <div className="pl-5 space-y-1.5 border-l border-white/10 ml-1.5">
                  <div className="flex items-center justify-between gap-3 text-[#F2F3F5]">
                    <span className="truncate">
                      <span className="text-[#a3ab72]">#</span> log-logoto
                    </span>
                    <span className="text-[#b9bbbe] truncate">tz=Europe/Paris;lang=fr</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[#b9bbbe]">
                    <span className="truncate">
                      <span className="text-[#a3ab72]">#</span> l-25-12
                    </span>
                    <span className="truncate">https://…/winter-logo.png</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[#b9bbbe]">
                    <span className="truncate">
                      <span className="text-[#a3ab72]">#</span> b-1-10
                    </span>
                    <span className="truncate">https://…/autumn-banner.jpg</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[#b9bbbe]">
                    <span className="truncate">
                      <span className="text-[#a3ab72]">#</span> n-1-1
                    </span>
                    <span className="truncate">Mon Serveur · 2027</span>
                  </div>
                </div>
              </div>
            </article>

            {/* 02. Four Supported Asset Types (5 cols) */}
            <article className="lg:col-span-5 rounded-xl bg-[#2b2d31] border border-white/[0.08] p-6 sm:p-7 flex flex-col justify-between gap-6">
              <div className="space-y-2.5">
                <h3 className="font-display text-lg sm:text-xl font-bold text-[#F2F3F5]">
                  {copy.bento.cards.assetsTitle}
                </h3>
                <p className="text-sm sm:text-[15px] text-[#b9bbbe] leading-relaxed">
                  {copy.bento.cards.assetsDesc}
                </p>
              </div>

              <div className="divide-y divide-white/[0.08] border-t border-white/[0.08]">
                {copy.bento.cards.assetsList.map((item) => (
                  <div
                    key={item.code}
                    className="py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F2F3F5] truncate">{item.label}</p>
                      <p className="text-xs text-[#b9bbbe] truncate">{item.spec}</p>
                    </div>
                    <code className="font-mono text-xs text-[#a3ab72] bg-[#1e1f22] px-2 py-1 rounded shrink-0">
                      {item.code}
                    </code>
                  </div>
                ))}
              </div>
            </article>

            {/* 03. Timezones (5 cols) */}
            <article className="lg:col-span-5 rounded-xl bg-[#2b2d31] border border-white/[0.08] p-6 sm:p-7 flex flex-col justify-between gap-6">
              <div className="space-y-2.5">
                <h3 className="font-display text-lg sm:text-xl font-bold text-[#F2F3F5]">
                  {copy.bento.cards.tzTitle}
                </h3>
                <p className="text-sm sm:text-[15px] text-[#b9bbbe] leading-relaxed">
                  {copy.bento.cards.tzDesc}
                </p>
              </div>

              <div className="rounded-lg bg-[#1e1f22] border border-white/[0.06] divide-y divide-white/[0.06] font-mono text-xs tabular-nums">
                {[
                  { tz: 'Europe/Paris', offset: 'CET / CEST · 00:00' },
                  { tz: 'America/Toronto', offset: 'EST / EDT · 00:00' },
                  { tz: 'UTC+2', offset: '+02:00 fixe · 00:00' },
                ].map((row) => (
                  <div
                    key={row.tz}
                    className="px-4 py-2.5 flex items-center justify-between gap-3"
                  >
                    <span className="text-[#a3ab72] font-medium truncate">{row.tz}</span>
                    <span className="text-[#b9bbbe] shrink-0 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#a3ab72]/80" aria-hidden="true" />
                      {row.offset}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            {/* 04. Web Dashboard & .txt Backup (7 cols) */}
            <article className="lg:col-span-7 rounded-xl bg-[#2b2d31] border border-white/[0.08] p-6 sm:p-7 flex flex-col justify-between gap-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2.5 max-w-xl">
                  <h3 className="font-display text-lg sm:text-xl font-bold text-[#F2F3F5]">
                    {copy.bento.cards.portableTitle}
                  </h3>
                  <p className="text-sm sm:text-[15px] text-[#b9bbbe] leading-relaxed">
                    {copy.bento.cards.portableDesc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg bg-[#1e1f22] hover:bg-[#8c935d] border border-white/12 text-xs font-bold text-[#F2F3F5] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start"
                >
                  <span>{copy.bento.cards.portableCta}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              <pre className="rounded-lg bg-[#1e1f22] border border-white/[0.06] p-4 font-mono text-xs text-[#b9bbbe] overflow-x-auto leading-relaxed">
{`# Logoto Export
log-logoto:tz=Europe/Paris;lang=fr
l-25-12:https://raw.githubusercontent.com/.../noel.png
b-21-6:https://raw.githubusercontent.com/.../summer.jpg`}
              </pre>
            </article>
          </div>
        </div>
      </section>

      {/* ===================================================================
          SECTION 3: THREE-STEP WORKFLOW
         =================================================================== */}
      <section
        aria-labelledby="workflow-heading"
        className="border-t border-white/[0.08] max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-14 sm:py-20 space-y-10"
      >
        <h2
          id="workflow-heading"
          className="font-display font-extrabold text-[#F2F3F5] tracking-tight text-balance"
          style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)' }}
        >
          {copy.workflow.title}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {copy.workflow.steps.map((step) => (
            <div key={step.num} className="pt-5 border-t border-white/15 space-y-2.5">
              <span className="font-mono text-xs font-semibold text-[#a3ab72] tabular-nums">
                {step.num}
              </span>
              <h3 className="font-display text-lg font-bold text-[#F2F3F5]">{step.title}</h3>
              <p className="text-sm sm:text-[15px] text-[#b9bbbe] leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================
          SECTION 4: CLOSING CONVERSION BAND
         =================================================================== */}
      <section className="border-t border-white/[0.08] bg-[#2b2d31]/60">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-12 sm:py-16 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] text-balance">
              {copy.cta.title}
            </h2>
            <p className="text-sm sm:text-base text-[#b9bbbe] leading-relaxed">
              {copy.cta.subtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-3 rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-sm font-bold text-[#F2F3F5] transition-colors whitespace-nowrap"
            >
              <span>{copy.cta.primary}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => onNavigate('docs', undefined, 'setup')}
              className="inline-flex items-center justify-center min-h-[46px] px-6 py-3 rounded-lg bg-[#23252a] hover:bg-[#313338] border border-white/12 text-sm font-semibold text-[#F2F3F5] transition-colors cursor-pointer whitespace-nowrap"
            >
              {copy.cta.secondary}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
