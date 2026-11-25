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
    <header className="w-full bg-[#23252a]/95 backdrop-blur-md border-b border-white/[0.08] sticky top-0 z-40">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Clean single-element Brand Lockup */}
        <button
          type="button"
          onClick={() => handleLinkClick('home')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72]"
        >
          <ResilientImage
            src={ASSETS.emblem}
            alt="Logoto"
            fallbackLabel="L"
            className="w-8 h-8 object-contain shrink-0 transition-transform duration-200 group-hover:rotate-12"
          />
          <span className="font-display text-xl font-extrabold tracking-tight text-[#F2F3F5] whitespace-nowrap shrink-0">
            Logoto
          </span>
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label={locale === 'fr' ? 'Navigation principale' : 'Primary navigation'}
          className="hidden md:flex items-center gap-7 text-sm font-semibold"
        >
          <button
            type="button"
            onClick={() => handleLinkClick('home')}
            className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72] ${
              route === 'home'
                ? 'text-[#F2F3F5]'
                : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
            }`}
          >
            {copy.home}
            {route === 'home' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[#a3ab72] rounded-full"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('dashboard')}
            className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72] ${
              route === 'dashboard'
                ? 'text-[#F2F3F5]'
                : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
            }`}
          >
            {copy.dashboard}
            {route === 'dashboard' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[#a3ab72] rounded-full"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('docs')}
            className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72] ${
              route === 'docs'
                ? 'text-[#F2F3F5]'
                : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
            }`}
          >
            {copy.docs}
            {route === 'docs' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[#a3ab72] rounded-full"
              />
            )}
          </button>
          <a
            href={EXTERNAL_LINKS.supportInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 whitespace-nowrap shrink-0 text-[#b9bbbe] hover:text-[#F2F3F5] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72]"
          >
            {copy.support}
          </a>
        </nav>

        {/* Zone 3: Primary CTA button + Mobile menu button */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-bold rounded-lg bg-[#8c935d] hover:bg-[#767d4f] text-[#F2F3F5] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a3ab72]"
          >
            {copy.addBot}
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={locale === 'fr' ? 'Ouvrir le menu' : 'Toggle menu'}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-white/10 bg-[#2b2d31] text-[#F2F3F5] hover:bg-[#313338] transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.08] bg-[#2b2d31] px-4 py-4 space-y-1.5">
          <button
            type="button"
            onClick={() => handleLinkClick('home')}
            className={`flex items-center w-full min-h-[44px] text-left px-3.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              route === 'home'
                ? 'bg-[#8c935d]/20 text-[#a3ab72]'
                : 'text-[#F2F3F5]/90 hover:bg-white/5'
            }`}
          >
            {copy.home}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('dashboard')}
            className={`flex items-center w-full min-h-[44px] text-left px-3.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              route === 'dashboard'
                ? 'bg-[#8c935d]/20 text-[#a3ab72]'
                : 'text-[#F2F3F5]/90 hover:bg-white/5'
            }`}
          >
            {copy.dashboard}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('docs')}
            className={`flex items-center w-full min-h-[44px] text-left px-3.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              route === 'docs'
                ? 'bg-[#8c935d]/20 text-[#a3ab72]'
                : 'text-[#F2F3F5]/90 hover:bg-white/5'
            }`}
          >
            {copy.docs}
          </button>
          <a
            href={EXTERNAL_LINKS.supportInvite}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className="flex items-center w-full min-h-[44px] text-left px-3.5 rounded-lg text-sm font-semibold text-[#F2F3F5]/90 hover:bg-white/5"
          >
            {copy.support}
          </a>
          <div className="pt-2">
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center w-full min-h-[44px] px-4 rounded-lg text-sm font-bold bg-[#8c935d] hover:bg-[#767d4f] text-[#F2F3F5] transition-colors"
            >
              {copy.addBot}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
