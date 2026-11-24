import { EXTERNAL_LINKS, UI_COPY } from '../translations';
import type { PageRoute, WebLocale } from '../types';

interface FooterProps {
  locale: WebLocale;
  onLocaleChange: (locale: WebLocale) => void;
  onNavigate: (route: PageRoute, hash?: string) => void;
}

export function Footer({ locale, onLocaleChange, onNavigate }: FooterProps) {
  const copy = UI_COPY[locale].footer;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#2f3136] border-t border-white/8 mt-auto">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#b9bbbe]">
        <p className="tabular-nums">
          &copy; {year} {copy.rights}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <div
            role="group"
            aria-label={locale === 'fr' ? 'Sélection de la langue' : 'Language selector'}
            className="inline-flex items-center p-0.5 rounded-lg bg-[#36393f] border border-white/10"
          >
            <button
              type="button"
              onClick={() => onLocaleChange('fr')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                locale === 'en'
                  ? 'bg-[#8c935d] text-[#F2F3F5]'
                  : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
              }`}
            >
              EN
            </button>
          </div>

          <a
            href={EXTERNAL_LINKS.betterUptime}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#a3ab72] transition-colors whitespace-nowrap shrink-0"
          >
            {copy.status}
          </a>
          <a
            href={EXTERNAL_LINKS.githubRepo}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#a3ab72] transition-colors whitespace-nowrap shrink-0"
          >
            {copy.github}
          </a>
          <button
            type="button"
            onClick={() => onNavigate('legal', '#tos')}
            className="hover:text-[#a3ab72] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copy.tos}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('legal', '#privacy')}
            className="hover:text-[#a3ab72] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copy.privacy}
          </button>
        </div>
      </div>
    </footer>
  );
}
