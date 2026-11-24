import { useState } from 'react';
import { EXTERNAL_LINKS, UI_COPY } from '../translations';
import type { DocSectionId, EventCategory, WebLocale } from '../types';

interface DocsViewProps {
  locale: WebLocale;
  activeSection: DocSectionId;
  onSelectSection: (section: DocSectionId) => void;
  onLocaleChange: (locale: WebLocale) => void;
}

export function DocsView({
  locale,
  activeSection,
  onSelectSection,
  onLocaleChange,
}: DocsViewProps) {
  const [selectedEvent, setSelectedEvent] = useState<EventCategory>('l');
  const [imageHostTab, setImageHostTab] = useState<'github' | 'imgbb'>('github');
  const sidebarItems = UI_COPY[locale].docs.sidebar;
  const isFr = locale === 'fr';

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-10 lg:py-12">
      <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
        {/* Left Sidebar matching logoto.onrender.com/fr/help */}
        <aside className="md:w-60 shrink-0">
          <div className="md:sticky md:top-24 space-y-6">
            <div
              role="group"
              aria-label={isFr ? 'Langue' : 'Language'}
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

            <nav
              aria-label={isFr ? 'Sections de documentation' : 'Documentation sections'}
              className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0"
            >
              {sidebarItems.map((item) => {
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    className={`text-left px-3 py-2 rounded-lg text-[15px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'text-[#a3ab72] bg-[#2f3136] border border-[#8c935d]/40'
                        : 'text-[#F2F3F5]/60 hover:text-[#a3ab72] border border-transparent'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Vertical Divider */}
        <div className="hidden md:block w-px bg-white/15 shrink-0" aria-hidden="true" />

        {/* Content Area */}
        <main className="flex-1 min-w-0 space-y-6">
          {activeSection === 'setup' && (
            <section className="space-y-6">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-[#a3ab72] mb-3">
                  {isFr ? 'Configuration (Setup)' : 'Configuration (Setup)'}
                </h1>
                <p className="text-[#F2F3F5]/85 leading-relaxed">
                  {isFr
                    ? "Je suis le bot spécialisé dans l'automatisation du changement de logo, de nom, de bannière et d'image d'invitation de votre serveur Discord, sans nécessiter de base de données ni de configuration complexe."
                    : "Logoto specializes in automating your Discord server's icon, name, banner, and invite image changes with zero external database or complex setup."}
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-2xl font-bold text-[#a3ab72] pb-2 border-b border-white/15">
                  {isFr ? 'Premiers pas' : 'Getting Started'}
                </h2>
                <p className="text-[#F2F3F5]/85">
                  {isFr
                    ? 'Pour commencer à utiliser le bot au maximum de ses capacités, lancez simplement la commande de configuration initiale :'
                    : 'To get started with Logoto, simply run the initial setup command on your server:'}
                </p>
                <div className="rounded-lg bg-[#2f3136] border border-white/10 p-4 text-[15px] text-[#F2F3F5]/90">
                  <code className="bg-[#202225] px-2 py-1 rounded text-white font-semibold mr-2">
                    /setup
                  </code>
                  <span>
                    {isFr
                      ? 'Première commande à faire. Crée automatiquement la catégorie et les salons nécessaires (Logoto, log-logoto) et configure votre langue et votre fuseau horaire.'
                      : 'First command to run. Automatically creates the Logoto category and log-logoto channel, and sets your language and timezone.'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-[#2f3136] border border-[#8c935d]/45 p-5 space-y-3 text-[15px] text-[#F2F3F5]/90 leading-relaxed">
                <p>
                  <strong className="text-[#a3ab72]">
                    {isFr ? 'NOTE IMPORTANTE : ' : 'IMPORTANT NOTE: '}
                  </strong>
                  {isFr
                    ? 'Le salon nommé log-logoto doit impérativement exister sur votre serveur pour assurer le suivi technique et la configuration du fuseau horaire.'
                    : 'The log-logoto channel must remain on your server to store your timezone/language configuration and receive execution logs.'}
                </p>
                <p>
                  {isFr
                    ? "Le bot utilise ce salon pour enregistrer sa configuration (tz=...;lang=...) et publier ses comptes-rendus lorsqu'un changement programmé s'exécute le jour même. S'il n'y a aucun événement, aucun log n'est posté."
                    : 'The bot uses this channel to store its configuration (tz=...;lang=...) and post execution summaries only on days when a scheduled event actually runs.'}
                </p>
              </div>
            </section>
          )}

          {activeSection === 'how-it-works' && (
            <section className="space-y-6">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-[#a3ab72] mb-3">
                  {isFr ? 'Fonctionnement Général' : 'General Operation'}
                </h1>
                <p className="text-[#F2F3F5]/85 leading-relaxed">
                  {isFr
                    ? 'Logoto surveille de manière autonome les salons textuels de votre catégorie privée Logoto pour planifier et exécuter vos mises à jour esthétiques.'
                    : 'Logoto autonomously reads the text channels inside your private Logoto category to schedule and apply your visual updates.'}
                </p>
              </div>

              <div className="rounded-lg bg-[#2b3a2e]/60 border border-[#a3ab72]/40 p-5 text-[15px] text-[#F2F3F5]/90 leading-relaxed">
                <strong className="text-[#a3ab72]">
                  {isFr ? 'Planification horaire : ' : 'Scheduled execution: '}
                </strong>
                {isFr
                  ? 'Toutes les mises à jour s’exécutent chaque jour à 00h00 dans le fuseau horaire défini pour votre serveur (modifiables à tout moment via /settings ou dans la rubrique Fuseau horaire).'
                  : 'All scheduled updates trigger daily at 00:00 in your server’s configured timezone (adjustable anytime via /settings).'}
              </div>

              <div className="space-y-4">
                <h2 className="font-display text-2xl font-bold text-[#a3ab72] pb-2 border-b border-white/15">
                  {isFr ? 'Règles de priorité et limites' : 'Priority Rules and Limits'}
                </h2>
                <p className="text-[#F2F3F5]/85">
                  {isFr
                    ? "Pour garantir la stabilité du serveur et respecter les quotas de l'API Discord, Logoto applique des règles strictes de gestion quotidienne :"
                    : 'To keep your server stable and respect Discord API rate limits, Logoto enforces strict daily rules:'}
                </p>
                <ol className="list-decimal pl-6 space-y-3 text-[15px] text-[#F2F3F5]/85 leading-relaxed">
                  <li>
                    <strong className="text-[#F2F3F5]">
                      {isFr ? 'Un seul changement par type et par jour : ' : 'One change per type per day: '}
                    </strong>
                    {isFr
                      ? "Le nom du serveur peut changer une fois par jour, le logo une fois, la bannière une fois, et le fond d'invitation une fois."
                      : 'The server name can change once per day, the logo once, the banner once, and the invite splash once.'}
                  </li>
                  <li>
                    <strong className="text-[#F2F3F5]">
                      {isFr ? 'Modifications simultanées : ' : 'Simultaneous changes: '}
                    </strong>
                    {isFr
                      ? 'Il est tout à fait possible de changer le logo ET le nom (ou tout autre élément) le même jour. Les actions s’exécuteront à l’heure planifiée.'
                      : 'You can change the logo AND the name (or any combination of assets) on the same day. All scheduled changes will run together.'}
                  </li>
                  <li>
                    <strong className="text-[#F2F3F5]">
                      {isFr ? 'Gestion des doublons (Priorité visuelle) : ' : 'Duplicate handling (Visual priority): '}
                    </strong>
                    {isFr
                      ? 'Si vous avez créé plusieurs salons pour le même élément le même jour (par exemple deux salons l-25-12), c’est le salon situé le plus haut dans la liste qui prime.'
                      : 'If multiple channels exist for the same asset type on the same day, the channel positioned highest in the category list takes precedence.'}
                  </li>
                </ol>
              </div>
            </section>
          )}

          {activeSection === 'timezone' && (
            <section className="space-y-6">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-[#a3ab72] mb-3">
                  {isFr ? 'Fuseau Horaire (Timezone)' : 'Timezone Configuration'}
                </h1>
                <p className="text-[#F2F3F5]/85 leading-relaxed">
                  {isFr
                    ? "Par défaut, Logoto déclenche les modifications du serveur à 00h00 UTC. Vous pouvez choisir un fuseau IANA (avec gestion automatique de l'heure d'été) ou un décalage fixe UTC± lors de /setup ou via /settings."
                    : 'By default, Logoto triggers server updates at 00:00 UTC. You can select an IANA timezone (with automatic Daylight Saving Time) or a fixed UTC± offset during /setup or via /settings.'}
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-2xl font-bold text-[#a3ab72] pb-2 border-b border-white/15">
                  {isFr ? 'Formats acceptés' : 'Accepted Formats'}
                </h2>
                <ul className="space-y-3">
                  <li className="rounded-lg bg-[#2f3136] border border-white/10 p-4 text-[15px]">
                    <strong className="text-[#F2F3F5] block mb-1.5">
                      {isFr ? 'Fuseaux IANA (Recommandé)' : 'IANA Timezones (Recommended)'}
                    </strong>
                    <div className="flex flex-wrap gap-2 font-mono text-xs text-[#a3ab72]">
                      <code className="bg-[#202225] px-2 py-1 rounded">Europe/Paris</code>
                      <code className="bg-[#202225] px-2 py-1 rounded">Europe/London</code>
                      <code className="bg-[#202225] px-2 py-1 rounded">America/Toronto</code>
                      <code className="bg-[#202225] px-2 py-1 rounded">America/New_York</code>
                      <code className="bg-[#202225] px-2 py-1 rounded">UTC</code>
                    </div>
                  </li>
                  <li className="rounded-lg bg-[#2f3136] border border-white/10 p-4 text-[15px]">
                    <strong className="text-[#F2F3F5] block mb-1.5">
                      {isFr ? 'Décalages fixes UTC±' : 'Fixed UTC± Offsets'}
                    </strong>
                    <div className="flex flex-wrap gap-2 font-mono text-xs text-[#a3ab72]">
                      <code className="bg-[#202225] px-2 py-1 rounded">UTC+1</code>
                      <code className="bg-[#202225] px-2 py-1 rounded">UTC+2</code>
                      <code className="bg-[#202225] px-2 py-1 rounded">UTC-5</code>
                      <code className="bg-[#202225] px-2 py-1 rounded">+5:30</code>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg bg-[#2f3136] border border-[#8c935d]/45 p-5 text-[15px] text-[#F2F3F5]/90">
                <strong className="text-[#a3ab72] block mb-1">
                  {isFr ? "Exemple d'utilisation :" : 'Usage example:'}
                </strong>
                {isFr
                  ? "Pour que les événements de votre serveur se déclenchent à l'heure française toute l'année (hiver comme été), choisissez Europe/Paris dans /setup ou /settings."
                  : 'To trigger your server events at Paris local time year-round (including DST), select Europe/Paris in /setup or /settings.'}
              </div>
            </section>
          )}

          {activeSection === 'commands' && (
            <section className="space-y-6">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-[#a3ab72] mb-3">
                  {isFr ? 'Les Commandes du Bot Logoto' : 'Logoto Bot Commands'}
                </h1>
                <p className="text-[#F2F3F5]/85 leading-relaxed">
                  {isFr
                    ? 'Découvrez la liste complète des commandes slash intégrées à Logoto :'
                    : 'Explore all slash commands built into Logoto:'}
                </p>
              </div>

              <ul className="space-y-3">
                {[
                  {
                    cmd: '/setup',
                    desc: isFr
                      ? 'Assistant de configuration initiale : choix de la langue (FR/EN), du fuseau horaire (IANA ou UTC±) et création de la catégorie Logoto et du salon log-logoto.'
                      : 'Initial setup wizard: choose language (FR/EN), timezone (IANA or UTC±), and create the Logoto category and log-logoto channel.',
                  },
                  {
                    cmd: '/settings',
                    desc: isFr
                      ? 'Interface de gestion complète : modifier le fuseau ou la langue, créer un événement, modifier ou supprimer un événement existant, et exporter/importer la configuration (.txt).'
                      : 'Full management panel: edit timezone or language, create events, edit or delete existing events, and export/import configuration (.txt).',
                  },
                  {
                    cmd: '/ping',
                    desc: isFr
                      ? 'Vérifier la latence WebSocket et le statut du bot.'
                      : 'Check Logoto WebSocket latency and online status.',
                  },
                  {
                    cmd: '/help',
                    desc: isFr
                      ? "Afficher l'aide rapide des commandes, types d'événements et fuseaux horaires dans Discord."
                      : 'Display a quick localized help summary of commands, event types, and timezones.',
                  },
                  {
                    cmd: '/about',
                    desc: isFr
                      ? "Afficher les informations, liens utiles, lien d'invitation et temps de fonctionnement."
                      : 'Show bot information, useful links, invite URL, and uptime.',
                  },
                ].map((item) => (
                  <li
                    key={item.cmd}
                    className="rounded-lg bg-[#2f3136] border border-white/10 p-4 text-[15px] text-[#F2F3F5]/85"
                  >
                    <code className="bg-[#202225] px-2 py-1 rounded text-white font-bold mr-2.5">
                      {item.cmd}
                    </code>
                    <span>{item.desc}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {activeSection === 'events' && (
            <section className="space-y-6">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-[#a3ab72] mb-3">
                  {isFr ? 'Ajouter un événement' : 'Add a Scheduled Event'}
                </h1>
                <p className="text-[#F2F3F5]/85 leading-relaxed">
                  {isFr
                    ? 'Depuis /settings, cliquez sur « Créer un événement » pour générer un salon au format {type}-{jour}-{mois}. Choisissez un type ci-dessous :'
                    : 'In /settings, click "Create event" to generate a channel named {type}-{day}-{month}. Select an event type below:'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    id: 'l' as const,
                    title: isFr ? 'Logo (l-JJ-MM)' : 'Logo (l-DD-MM)',
                    desc: isFr
                      ? 'Modifier la photo de profil du serveur à une date précise.'
                      : 'Change the server icon on a specific date.',
                  },
                  {
                    id: 'n' as const,
                    title: isFr ? 'Nom (n-JJ-MM)' : 'Name (n-DD-MM)',
                    desc: isFr
                      ? 'Modifier le nom officiel du serveur à une date précise.'
                      : 'Change the official server name on a specific date.',
                  },
                  {
                    id: 'b' as const,
                    title: isFr ? 'Bannière (b-JJ-MM)' : 'Banner (b-DD-MM)',
                    desc: isFr
                      ? 'Appliquer une bannière personnalisée (Boost Niveau 2+).'
                      : 'Apply a custom server banner (Boost Level 2+).',
                  },
                  {
                    id: 'i' as const,
                    title: isFr ? "Fond d'invitation (i-JJ-MM)" : 'Invite Splash (i-DD-MM)',
                    desc: isFr
                      ? "Personnaliser l'arrière-plan d'invitation (Boost Niveau 1+)."
                      : 'Customize the invite splash background (Boost Level 1+).',
                  },
                ].map((card) => {
                  const active = selectedEvent === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedEvent(card.id)}
                      className={`text-left p-6 rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#8c935d]/15 border-[#a3ab72]'
                          : 'bg-[#2f3136] border-white/10 hover:border-[#8c935d]/60'
                      }`}
                    >
                      <h3
                        className={`font-display text-lg font-bold mb-1.5 ${
                          active ? 'text-[#a3ab72]' : 'text-[#F2F3F5]'
                        }`}
                      >
                        {card.title}
                      </h3>
                      <p className="text-sm text-[#F2F3F5]/75">{card.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-lg bg-[#2f3136] border border-[#8c935d]/40 p-6 space-y-4 text-[15px] text-[#F2F3F5]/85">
                {selectedEvent === 'l' && (
                  <>
                    <h3 className="font-display text-xl font-bold text-[#F2F3F5]">
                      {isFr ? 'Configuration du Logo Automatique' : 'Automatic Logo Configuration'}
                    </h3>
                    <ol className="list-decimal pl-5 space-y-2.5">
                      <li>
                        <strong>{isFr ? 'Format du salon :' : 'Channel format:'}</strong>{' '}
                        <code className="bg-[#202225] px-1.5 py-0.5 rounded text-white">l-[JOUR]-[MOIS]</code>{' '}
                        ({isFr ? 'ex :' : 'e.g.'}{' '}
                        <code className="bg-[#202225] px-1.5 py-0.5 rounded text-white">l-25-12</code>)
                      </li>
                      <li>
                        <strong>{isFr ? 'Taille recommandée par Discord :' : 'Recommended size:'}</strong>{' '}
                        {isFr
                          ? 'Un carré parfait de 512 × 512 pixels (.png, .jpg, .jpeg ou .gif via URL HTTPS permanente).'
                          : 'A 512 × 512 px square (.png, .jpg, .jpeg, or .gif via permanent HTTPS URL).'}
                      </li>
                      <li>
                        <strong>{isFr ? 'Planification :' : 'Scheduling:'}</strong>{' '}
                        {isFr
                          ? "Via /settings → Créer un événement, ou en collant l'URL permanente de l'image dans le sujet du salon."
                          : 'Via /settings → Create event, or by placing the permanent image URL in the channel topic.'}
                      </li>
                    </ol>
                  </>
                )}

                {selectedEvent === 'n' && (
                  <>
                    <h3 className="font-display text-xl font-bold text-[#F2F3F5]">
                      {isFr ? 'Configuration du Nom Automatique' : 'Automatic Name Configuration'}
                    </h3>
                    <ol className="list-decimal pl-5 space-y-2.5">
                      <li>
                        <strong>{isFr ? 'Format du salon :' : 'Channel format:'}</strong>{' '}
                        <code className="bg-[#202225] px-1.5 py-0.5 rounded text-white">n-[JOUR]-[MOIS]</code>{' '}
                        ({isFr ? 'ex :' : 'e.g.'}{' '}
                        <code className="bg-[#202225] px-1.5 py-0.5 rounded text-white">n-1-1</code>)
                      </li>
                      <li>
                        <strong>{isFr ? 'Valeur attendue :' : 'Expected value:'}</strong>{' '}
                        {isFr
                          ? 'Le nouveau nom complet du serveur (entre 2 et 100 caractères) enregistré dans le sujet du salon.'
                          : 'The new full server name (2 to 100 characters) stored in the channel topic.'}
                      </li>
                    </ol>
                  </>
                )}

                {selectedEvent === 'b' && (
                  <>
                    <h3 className="font-display text-xl font-bold text-[#F2F3F5]">
                      {isFr ? 'Configuration de la Bannière Automatique' : 'Automatic Banner Configuration'}
                    </h3>
                    <p className="text-sm italic text-[#a3ab72]">
                      {isFr
                        ? 'Note : Votre serveur doit posséder le niveau de Boost requis (Niveau 2+) pour appliquer des bannières personnalisées.'
                        : 'Note: Your server requires Boost Level 2+ to apply custom server banners.'}
                    </p>
                    <ol className="list-decimal pl-5 space-y-2.5">
                      <li>
                        <strong>{isFr ? 'Format du salon :' : 'Channel format:'}</strong>{' '}
                        <code className="bg-[#202225] px-1.5 py-0.5 rounded text-white">b-[JOUR]-[MOIS]</code>{' '}
                        ({isFr ? 'ex :' : 'e.g.'}{' '}
                        <code className="bg-[#202225] px-1.5 py-0.5 rounded text-white">b-25-12</code>)
                      </li>
                      <li>
                        <strong>{isFr ? 'Taille recommandée par Discord :' : 'Recommended size:'}</strong>{' '}
                        {isFr
                          ? '960 × 540 pixels (ratio 16:9). Veillez à centrer les éléments importants pour éviter les recadrages.'
                          : '960 × 540 pixels (16:9 ratio). Keep key elements centered to avoid cropping.'}
                      </li>
                    </ol>
                  </>
                )}

                {selectedEvent === 'i' && (
                  <>
                    <h3 className="font-display text-xl font-bold text-[#F2F3F5]">
                      {isFr
                        ? "Configuration du Fond d'Invitation Automatique"
                        : 'Automatic Invite Splash Configuration'}
                    </h3>
                    <p className="text-sm italic text-[#a3ab72]">
                      {isFr
                        ? "Note : Votre serveur doit posséder le niveau de Boost requis (Niveau 1+) pour appliquer une image de fond d'invitation personnalisée."
                        : 'Note: Your server requires Boost Level 1+ to apply a custom invite splash.'}
                    </p>
                    <ol className="list-decimal pl-5 space-y-2.5">
                      <li>
                        <strong>{isFr ? 'Format du salon :' : 'Channel format:'}</strong>{' '}
                        <code className="bg-[#202225] px-1.5 py-0.5 rounded text-white">i-[JOUR]-[MOIS]</code>{' '}
                        ({isFr ? 'ex :' : 'e.g.'}{' '}
                        <code className="bg-[#202225] px-1.5 py-0.5 rounded text-white">i-14-7</code>)
                      </li>
                      <li>
                        <strong>{isFr ? 'Taille recommandée par Discord :' : 'Recommended size:'}</strong>{' '}
                        {isFr
                          ? '1920 × 1080 pixels (ratio standard 16:9) pour un rendu net sur tous les écrans web et mobiles.'
                          : '1920 × 1080 pixels (16:9 ratio) for sharp rendering across desktop and mobile.'}
                      </li>
                    </ol>
                  </>
                )}
              </div>
            </section>
          )}

          {activeSection === 'links' && (
            <section className="space-y-6">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-[#a3ab72] mb-3">
                  {isFr ? "Obtenir un lien d'image persistant" : 'Getting a Persistent Image Link'}
                </h1>
                <p className="text-[#F2F3F5]/85 leading-relaxed">
                  {isFr
                    ? "Pour que Logoto puisse appliquer vos logos, bannières ou images d'invitation à l'avenir, l'URL que vous lui fournissez doit rester accessible de manière permanente. Comme les liens directs Discord expirent rapidement, utilisez un hébergeur permanent."
                    : 'For Logoto to apply your logos, banners, or invite splashes on future dates, the URL must remain permanently reachable. Because Discord CDN links expire quickly, use a permanent host.'}
                </p>
              </div>

              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImageHostTab('github')}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    imageHostTab === 'github'
                      ? 'bg-[#a3ab72] text-[#2f3136]'
                      : 'bg-[#202225] text-[#F2F3F5] hover:bg-[#8c935d]'
                  }`}
                >
                  {isFr ? 'GitHub (Recommandé)' : 'GitHub (Recommended)'}
                </button>
                <button
                  type="button"
                  onClick={() => setImageHostTab('imgbb')}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    imageHostTab === 'imgbb'
                      ? 'bg-[#a3ab72] text-[#2f3136]'
                      : 'bg-[#202225] text-[#F2F3F5] hover:bg-[#8c935d]'
                  }`}
                >
                  ImgBB / Imgur
                </button>
              </div>

              {imageHostTab === 'github' ? (
                <div className="rounded-lg bg-[#2f3136] border border-white/10 p-6 space-y-4 text-[15px] text-[#F2F3F5]/85">
                  <h3 className="font-display text-lg font-bold text-[#F2F3F5]">
                    {isFr ? 'Héberger via GitHub (Ultra-stable)' : 'Host via GitHub (Ultra-stable)'}
                  </h3>
                  <ol className="list-decimal pl-5 space-y-2.5">
                    <li>
                      <strong>{isFr ? 'Créez un dépôt public :' : 'Create a public repository:'}</strong>{' '}
                      {isFr
                        ? 'Allez sur GitHub, cliquez sur New repository, nommez-le et cochez "Add a README file".'
                        : 'Go to GitHub, click New repository, name it, and check "Add a README file".'}
                    </li>
                    <li>
                      <strong>{isFr ? 'Téléversez vos images :' : 'Upload your images:'}</strong>{' '}
                      {isFr
                        ? 'Cliquez sur "Add file" → "Upload files", déposez vos visuels puis validez avec "Commit changes".'
                        : 'Click "Add file" → "Upload files", drop your assets, and click "Commit changes".'}
                    </li>
                    <li>
                      <strong>{isFr ? "Obtenez l'URL brute (Raw) :" : 'Get the Raw URL:'}</strong>{' '}
                      {isFr
                        ? 'Ouvrez votre image sur GitHub puis cliquez sur "Raw". L’URL doit commencer par :'
                        : 'Open your image on GitHub and click "Raw". The URL should begin with:'}{' '}
                      <code className="bg-[#202225] px-1.5 py-0.5 rounded text-white">
                        https://raw.githubusercontent.com/...
                      </code>
                    </li>
                  </ol>
                  <div className="rounded-lg bg-[#292b2f] border border-[#8c935d]/40 p-4 text-sm">
                    <strong className="text-[#a3ab72] block mb-1">
                      {isFr ? 'Astuce :' : 'Tip:'}
                    </strong>
                    {isFr
                      ? 'Remplacez github.com/utilisateur/depot/blob/main/image.png par raw.githubusercontent.com/utilisateur/depot/main/image.png'
                      : 'Replace github.com/user/repo/blob/main/image.png with raw.githubusercontent.com/user/repo/main/image.png'}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-[#2f3136] border border-white/10 p-6 space-y-4 text-[15px] text-[#F2F3F5]/85">
                  <h3 className="font-display text-lg font-bold text-[#F2F3F5]">
                    {isFr ? 'Hébergeurs Gratuits (ImgBB / Imgur)' : 'Free Hosts (ImgBB / Imgur)'}
                  </h3>
                  <ol className="list-decimal pl-5 space-y-2.5">
                    <li>
                      {isFr ? 'Rendez-vous sur ' : 'Visit '}
                      <a
                        href="https://imgbb.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a3ab72] underline"
                      >
                        ImgBB
                      </a>{' '}
                      {isFr ? 'ou ' : 'or '}
                      <a
                        href="https://imgur.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a3ab72] underline"
                      >
                        Imgur
                      </a>{' '}
                      {isFr
                        ? "et téléversez votre image sans date d'expiration."
                        : 'and upload your image without an expiration timer.'}
                    </li>
                    <li>
                      {isFr
                        ? 'Sélectionnez impérativement le « Lien direct » (Direct Link) se terminant par .png, .jpg ou .gif.'
                        : 'Copy the "Direct Link" ending in .png, .jpg, or .gif.'}
                    </li>
                  </ol>
                </div>
              )}

              <p className="text-sm text-[#b9bbbe]">
                {isFr ? "Besoin d'aide supplémentaire ? " : 'Need additional help? '}
                <a
                  href={EXTERNAL_LINKS.supportInvite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a3ab72] underline"
                >
                  {isFr ? 'Rejoindre le serveur support' : 'Join the support server'}
                </a>
                .
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
