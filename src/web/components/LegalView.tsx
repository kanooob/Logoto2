import { EXTERNAL_LINKS, UI_COPY } from '../translations';
import type { WebLocale } from '../types';

interface LegalViewProps {
  locale: WebLocale;
  onLocaleChange: (locale: WebLocale) => void;
  onSelectSection?: (hash: '#tos' | '#privacy') => void;
}

export function LegalView({ locale, onLocaleChange, onSelectSection }: LegalViewProps) {
  const isFr = locale === 'fr';
  const copy = UI_COPY[locale].legal;

  return (
    <div className="max-w-[1320px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-12 animate-fade-in-up">
      <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
        <aside className="md:w-60 shrink-0">
          <div className="md:sticky md:top-24 space-y-5">
            <div
              role="group"
              aria-label={isFr ? 'Langue' : 'Language'}
              className="inline-flex items-center p-0.5 rounded-lg bg-[#2b2d31] border border-white/10"
            >
              <button
                type="button"
                onClick={() => onLocaleChange('fr')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  locale === 'en'
                    ? 'bg-[#8c935d] text-[#F2F3F5]'
                    : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
                }`}
              >
                EN
              </button>
            </div>

            <nav
              aria-label={isFr ? 'Navigation légale' : 'Legal navigation'}
              className="flex md:flex-col gap-1.5 overflow-x-auto no-scrollbar pb-2 md:pb-0"
            >
              <a
                href="#tos"
                onClick={(e) => {
                  if (onSelectSection) {
                    e.preventDefault();
                    onSelectSection('#tos');
                  }
                }}
                className="min-h-[42px] inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-semibold text-[#F2F3F5]/85 hover:text-[#a3ab72] hover:bg-[#2b2d31] border border-transparent hover:border-white/[0.08] transition-colors whitespace-nowrap shrink-0"
              >
                {copy.tosLink}
              </a>
              <a
                href="#privacy"
                onClick={(e) => {
                  if (onSelectSection) {
                    e.preventDefault();
                    onSelectSection('#privacy');
                  }
                }}
                className="min-h-[42px] inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-semibold text-[#F2F3F5]/85 hover:text-[#a3ab72] hover:bg-[#2b2d31] border border-transparent hover:border-white/[0.08] transition-colors whitespace-nowrap shrink-0"
              >
                {copy.privacyLink}
              </a>
            </nav>
          </div>
        </aside>

        <div className="hidden md:block w-px bg-white/[0.08] shrink-0" aria-hidden="true" />

        <main className="flex-1 min-w-0 max-w-3xl space-y-14">
          <section id="tos" className="space-y-5 scroll-mt-24">
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] tracking-tight">
                {isFr ? "Conditions Générales d'Utilisation (CGU)" : 'Terms of Service (ToS)'}
              </h1>
              <p className="text-xs text-[#b9bbbe] tabular-nums">
                {isFr ? 'Dernière mise à jour : 11/07/2026' : 'Last updated: 2026-07-11'}
              </p>
            </div>

            <div className="space-y-4 text-[15px] text-[#b9bbbe] leading-relaxed">
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#a3ab72] pt-2 pb-1.5 border-b border-white/[0.08]">
                {isFr ? '1. Acceptation des Conditions' : '1. Acceptance of Terms'}
              </h2>
              <p>
                {isFr
                  ? "Bienvenue sur Logoto, un service fourni par un développeur indépendant, Galaxie_S9. En ajoutant et en utilisant le bot Logoto sur votre serveur Discord, vous acceptez d'être lié par les présentes Conditions Générales d'Utilisation (CGU)."
                  : 'Welcome to Logoto, a service provided by an independent developer, Galaxie_S9. By adding and using Logoto on your Discord server, you agree to be bound by these Terms of Service.'}
              </p>

              <h2 className="font-display text-lg sm:text-xl font-bold text-[#a3ab72] pt-2 pb-1.5 border-b border-white/[0.08]">
                {isFr ? '2. Description du Service' : '2. Description of Service'}
              </h2>
              <p>
                {isFr
                  ? "Logoto est un bot Discord conçu pour l'automatisation. Son rôle principal est de permettre aux administrateurs de serveurs de changer automatiquement le logo, la bannière, l'image d'invitation et le nom de leur serveur Discord à des dates planifiées via /setup et /settings."
                  : 'Logoto is a Discord bot designed for automation. Its primary role is to let server administrators automatically update their server icon, banner, invite splash, and name on scheduled dates using /setup and /settings.'}
              </p>

              <h2 className="font-display text-lg sm:text-xl font-bold text-[#a3ab72] pt-2 pb-1.5 border-b border-white/[0.08]">
                {isFr ? "3. Engagements de l'Utilisateur" : '3. User Responsibilities'}
              </h2>
              <ol className="list-decimal pl-5 space-y-2.5">
                <li>
                  <strong className="text-[#F2F3F5]">
                    {isFr ? 'Conformité à Discord :' : 'Discord Compliance:'}
                  </strong>{' '}
                  {isFr ? "L'utilisation doit être conforme aux " : 'Usage must comply with '}
                  <a
                    href={EXTERNAL_LINKS.discordTerms}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#a3ab72] underline"
                  >
                    {isFr ? "Conditions d'Utilisation de Discord" : 'Discord Terms of Service'}
                  </a>{' '}
                  {isFr ? 'et aux ' : 'and '}
                  <a
                    href={EXTERNAL_LINKS.discordGuidelines}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#a3ab72] underline"
                  >
                    {isFr ? 'Directives de la Communauté' : 'Community Guidelines'}
                  </a>
                  .
                </li>
                <li>
                  <strong className="text-[#F2F3F5]">
                    {isFr ? 'Autorisations :' : 'Permissions:'}
                  </strong>{' '}
                  {isFr
                    ? 'Vous devez disposer des autorisations requises (Gérer le serveur) pour configurer Logoto.'
                    : 'You must hold Manage Server permissions to configure Logoto.'}
                </li>
                <li>
                  <strong className="text-[#F2F3F5]">
                    {isFr ? 'Contenu :' : 'Content:'}
                  </strong>{' '}
                  {isFr
                    ? "Il est interdit de planifier des visuels ou noms illégaux, offensants, haineux ou enfreignant les droits d'auteur."
                    : 'Scheduling illegal, hateful, offensive, or copyright-infringing names or visuals is prohibited.'}
                </li>
              </ol>

              <h2 className="font-display text-lg sm:text-xl font-bold text-[#a3ab72] pt-2 pb-1.5 border-b border-white/[0.08]">
                {isFr ? '4. Propriété Intellectuelle & Contact' : '4. Intellectual Property & Contact'}
              </h2>
              <p>
                {isFr
                  ? 'Le code source de Logoto est distribué sous licence MIT sur '
                  : 'Logoto source code is released under the MIT license on '}
                <a
                  href={EXTERNAL_LINKS.githubRepo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a3ab72] underline"
                >
                  GitHub
                </a>
                {isFr
                  ? '. Les logos et noms configurés demeurent la propriété exclusive de leurs auteurs. Contact : '
                  : '. Logos and server names remain the sole property of their respective owners. Contact: '}
                <a href={EXTERNAL_LINKS.contactEmail} className="text-[#a3ab72] underline">
                  galaxies9@duck.com
                </a>
                .
              </p>
            </div>
          </section>

          <section id="privacy" className="space-y-5 pt-10 border-t border-white/[0.08] scroll-mt-24">
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] tracking-tight">
                {isFr ? 'Politique de Confidentialité' : 'Privacy Policy'}
              </h1>
              <p className="text-xs text-[#b9bbbe] tabular-nums">
                {isFr ? 'Dernière mise à jour : 11/07/2026' : 'Last updated: 2026-07-11'}
              </p>
            </div>

            <div className="space-y-4 text-[15px] text-[#b9bbbe] leading-relaxed">
              <p>
                {isFr
                  ? 'Logoto fonctionne sans base de données externe et applique une stricte minimisation des données : toute votre configuration est stockée directement dans la catégorie privée Logoto de votre serveur Discord.'
                  : 'Logoto operates with zero external database and strict data minimization: your scheduling configuration is stored directly inside your server’s private Logoto category on Discord.'}
              </p>

              <div className="rounded-xl bg-[#2b2d31] border border-[#8c935d]/40 p-5 text-sm sm:text-[15px] text-[#F2F3F5]/90">
                <strong className="text-[#a3ab72]">
                  {isFr ? 'Logoto ne stocke PAS : ' : 'Logoto does NOT store: '}
                </strong>
                {isFr
                  ? 'les messages privés, le contenu des salons textuels de discussion, les adresses IP des utilisateurs, l’historique des membres ni aucune donnée personnelle sensible.'
                  : 'direct messages, chat channel content, user IP addresses, member history, or any sensitive personal data.'}
              </div>

              <h2 className="font-display text-lg sm:text-xl font-bold text-[#a3ab72] pt-2 pb-1.5 border-b border-white/[0.08]">
                {isFr ? 'Données traitées & RGPD' : 'Processed Data & GDPR'}
              </h2>
              <ul className="list-disc pl-5 space-y-2.5">
                <li>
                  {isFr
                    ? 'Identifiants de serveur (Guild ID) et salons de la catégorie Logoto (fuseau horaire, langue, noms et URLs planifiés).'
                    : 'Server IDs (Guild IDs) and Logoto category channels (timezone, language, scheduled names and URLs).'}
                </li>
                <li>
                  {isFr
                    ? 'Le retrait du bot ou la suppression de la catégorie Logoto supprime immédiatement les configurations associées. Contact RGPD : '
                    : 'Removing the bot or deleting the Logoto category immediately removes associated configurations. GDPR contact: '}
                  <a href={EXTERNAL_LINKS.contactEmail} className="text-[#a3ab72] underline">
                    galaxies9@duck.com
                  </a>
                  .
                </li>
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
