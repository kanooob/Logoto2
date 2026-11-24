import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ASSETS, EXTERNAL_LINKS, UI_COPY } from '../translations';
import type { PageRoute, WebLocale } from '../types';
import { ResilientImage } from './ResilientImage';

interface HeaderProps {
  locale: WebLocale;
  route: PageRoute;
  inviteUrl: string;
  onNavigate: (route: PageRoute) => void;
}

export function Header({ locale, route, inviteUrl, onNavigate }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const copy = UI_COPY[locale].nav;

  const handleLinkClick = (target: PageRoute) => {
    setMobileOpen(false);
    onNavigate(target);
  };

  return (
    <header className="w-full bg-[#36393f]/95 backdrop-blur-sm border-b border-white/8 sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-[72px] flex items-center justify-between gap-8">
        {/* Zone 1: Brand mark + wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('home')}
          className="flex items-center gap-3 text-left whitespace-nowrap shrink-0 group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72]"
        >
          <ResilientImage
            src={ASSETS.emblem}
            alt="Logo Logoto"
            fallbackLabel="L"
            className="w-9 h-9 rounded-lg object-cover shrink-0 transition-transform duration-200 group-hover:scale-105"
          />
          <span className="font-display text-[22px] font-extrabold tracking-tight text-[#F2F3F5] whitespace-nowrap shrink-0">
            Logoto
          </span>
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label={locale === 'fr' ? 'Navigation principale' : 'Primary navigation'}
          className="hidden md:flex items-center gap-8 text-[15px] font-semibold"
        >
          <button
            type="button"
            onClick={() => handleLinkClick('home')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72] ${
              route === 'home'
                ? 'text-[#a3ab72] border-[#a3ab72]'
                : 'text-[#F2F3F5]/80 border-transparent hover:text-[#a3ab72]'
            }`}
          >
            {copy.home}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('dashboard')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72] ${
              route === 'dashboard'
                ? 'text-[#a3ab72] border-[#a3ab72]'
                : 'text-[#F2F3F5]/80 border-transparent hover:text-[#a3ab72]'
            }`}
          >
            {copy.dashboard}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('docs')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72] ${
              route === 'docs'
                ? 'text-[#a3ab72] border-[#a3ab72]'
                : 'text-[#F2F3F5]/80 border-transparent hover:text-[#a3ab72]'
            }`}
          >
            {copy.docs}
          </button>
          <a
            href={EXTERNAL_LINKS.supportInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent text-[#F2F3F5]/80 hover:text-[#a3ab72] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72]"
          >
            {copy.support}
          </a>
        </nav>

        {/* Zone 3: Primary CTA button */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-[#F2F3F5] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a3ab72]"
          >
            {copy.addBot}
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={locale === 'fr' ? 'Ouvrir le menu' : 'Toggle menu'}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 bg-[#2f3136] text-[#F2F3F5] hover:bg-[#292b2f] transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/8 bg-[#2f3136] px-6 py-4 space-y-2">
          <button
            type="button"
            onClick={() => handleLinkClick('home')}
            className={`block w-full text-left py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              route === 'home' ? 'bg-[#8c935d]/20 text-[#a3ab72]' : 'text-[#F2F3F5]/85 hover:bg-white/5'
            }`}
          >
            {copy.home}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('dashboard')}
            className={`block w-full text-left py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              route === 'dashboard' ? 'bg-[#8c935d]/20 text-[#a3ab72]' : 'text-[#F2F3F5]/85 hover:bg-white/5'
            }`}
          >
            {copy.dashboard}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('docs')}
            className={`block w-full text-left py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              route === 'docs' ? 'bg-[#8c935d]/20 text-[#a3ab72]' : 'text-[#F2F3F5]/85 hover:bg-white/5'
            }`}
          >
            {copy.docs}
          </button>
          <a
            href={EXTERNAL_LINKS.supportInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-left py-2.5 px-3 rounded-lg text-sm font-semibold text-[#F2F3F5]/85 hover:bg-white/5"
          >
            {copy.support}
          </a>
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-2.5 px-4 mt-2 rounded-lg text-sm font-bold bg-[#8c935d] hover:bg-[#767d4f] text-[#F2F3F5] transition-colors"
          >
            {copy.addBot}
          </a>
        </div>
      )}
    </header>
  );
}
