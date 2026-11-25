import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe, LayoutDashboard, Menu, X } from 'lucide-react';
import { ASSETS, EXTERNAL_LINKS, UI_COPY } from '../translations';
import type { PageRoute, WebLocale } from '../types';
import { ResilientImage } from './ResilientImage';

interface HeaderProps {
  locale: WebLocale;
  route: PageRoute;
  inviteUrl: string;
  onLocaleChange: (locale: WebLocale) => void;
  onNavigate: (route: PageRoute) => void;
}

const LANGUAGE_OPTIONS: Array<{ value: WebLocale; label: string }> = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

export function Header({ locale, route, inviteUrl, onLocaleChange, onNavigate }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);
  const copy = UI_COPY[locale].nav;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleLinkClick = (target: PageRoute) => {
    setMobileOpen(false);
    setLangMenuOpen(false);
    onNavigate(target);
  };

  const handleSelectLocale = (nextLocale: WebLocale) => {
    onLocaleChange(nextLocale);
    setLangMenuOpen(false);
  };

  const activeLanguageLabel = locale === 'fr' ? 'Français' : 'English';

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

        {/* Zone 2: Navigation links + Language Dropdown Menu */}
        <nav
          aria-label={locale === 'fr' ? 'Navigation principale' : 'Primary navigation'}
          className="hidden md:flex items-center gap-7 text-sm font-semibold"
        >
          <button
            type="button"
            onClick={() => handleLinkClick('home')}
            className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72] ${
              route === 'home' ? 'text-[#F2F3F5]' : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
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
            onClick={() => handleLinkClick('docs')}
            className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72] ${
              route === 'docs' ? 'text-[#F2F3F5]' : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
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
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 whitespace-nowrap shrink-0 text-[#b9bbbe] hover:text-[#F2F3F5] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72]"
          >
            {copy.addBot}
          </a>

          <a
            href={EXTERNAL_LINKS.supportInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 whitespace-nowrap shrink-0 text-[#b9bbbe] hover:text-[#F2F3F5] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a3ab72]"
          >
            {copy.support}
          </a>

          {/* Language Dropdown Menu */}
          <div ref={langMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setLangMenuOpen((prev) => !prev)}
              aria-expanded={langMenuOpen}
              aria-haspopup="listbox"
              aria-label={locale === 'fr' ? 'Choisir la langue' : 'Choose language'}
              className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-sm font-semibold text-[#b9bbbe] hover:text-[#F2F3F5] hover:bg-white/[0.05] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Globe className="w-4 h-4 text-[#a3ab72]" aria-hidden="true" />
              <span>{activeLanguageLabel}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-150 ${langMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {langMenuOpen && (
              <div
                role="listbox"
                aria-label={locale === 'fr' ? 'Langues disponibles' : 'Available languages'}
                className="absolute right-0 mt-2 w-40 rounded-xl bg-[#2b2d31] border border-white/10 shadow-xl p-1.5 z-50"
              >
                {LANGUAGE_OPTIONS.map((opt) => {
                  const selected = opt.value === locale;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelectLocale(opt.value)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#8c935d]/20 text-[#F2F3F5]'
                          : 'text-[#b9bbbe] hover:bg-white/[0.05] hover:text-[#F2F3F5]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {selected && <Check className="w-4 h-4 text-[#a3ab72]" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Zone 3: Dashboard Primary CTA + Mobile menu trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick('dashboard')}
            className={`hidden sm:inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a3ab72] ${
              route === 'dashboard'
                ? 'bg-[#767d4f] text-[#F2F3F5] ring-2 ring-[#a3ab72]/60'
                : 'bg-[#8c935d] hover:bg-[#767d4f] text-[#F2F3F5]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            <span>{copy.dashboard}</span>
          </button>

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
        <div className="md:hidden border-t border-white/[0.08] bg-[#2b2d31] px-4 py-4 space-y-2">
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
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className="flex items-center w-full min-h-[44px] text-left px-3.5 rounded-lg text-sm font-semibold text-[#F2F3F5]/90 hover:bg-white/5"
          >
            {copy.addBot}
          </a>
          <a
            href={EXTERNAL_LINKS.supportInvite}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className="flex items-center w-full min-h-[44px] text-left px-3.5 rounded-lg text-sm font-semibold text-[#F2F3F5]/90 hover:bg-white/5"
          >
            {copy.support}
          </a>

          {/* Language Dropdown inside Mobile Menu */}
          <div className="pt-2 border-t border-white/[0.08]">
            <label
              htmlFor="mobile-lang-select"
              className="block text-xs font-semibold text-[#b9bbbe] mb-1.5 px-1"
            >
              {locale === 'fr' ? 'Langue' : 'Language'}
            </label>
            <div className="relative">
              <Globe
                className="w-4 h-4 text-[#a3ab72] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <select
                id="mobile-lang-select"
                value={locale}
                onChange={(e) => {
                  onLocaleChange(e.target.value as WebLocale);
                  setMobileOpen(false);
                }}
                className="w-full min-h-[44px] pl-10 pr-8 rounded-lg bg-[#1e1f22] border border-white/10 text-sm font-semibold text-[#F2F3F5] appearance-none cursor-pointer"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
              <ChevronDown
                className="w-4 h-4 text-[#b9bbbe] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleLinkClick('dashboard')}
              className="flex items-center justify-center gap-2 w-full min-h-[44px] px-4 rounded-lg text-sm font-bold bg-[#8c935d] hover:bg-[#767d4f] text-[#F2F3F5] transition-colors cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
              <span>{copy.dashboard}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
