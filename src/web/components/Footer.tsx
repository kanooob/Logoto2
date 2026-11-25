import { EXTERNAL_LINKS, UI_COPY } from '../translations';
import type { PageRoute, WebLocale } from '../types';

interface FooterProps {
  locale: WebLocale;
  onLocaleChange: (locale: WebLocale) => void;
  onNavigate: (route: PageRoute, hash?: string) => void;
}

export function Footer({ locale, onNavigate }: FooterProps) {
  const copy = UI_COPY[locale].footer;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#1e1f22] border-t border-white/[0.08] mt-auto">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#b9bbbe]">
        <p className="tabular-nums text-center sm:text-left">
          &copy; {year} {copy.rights}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a
            href={EXTERNAL_LINKS.betterUptime}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#a3ab72] transition-colors whitespace-nowrap shrink-0 py-1"
          >
            {copy.status}
          </a>
          <a
            href={EXTERNAL_LINKS.githubRepo}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#a3ab72] transition-colors whitespace-nowrap shrink-0 py-1"
          >
            {copy.github}
          </a>
          <button
            type="button"
            onClick={() => onNavigate('legal', '#tos')}
            className="hover:text-[#a3ab72] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1"
          >
            {copy.tos}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('legal', '#privacy')}
            className="hover:text-[#a3ab72] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1"
          >
            {copy.privacy}
          </button>
        </div>
      </div>
    </footer>
  );
}
