import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
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
}: DocsViewProps) {
  const [selectedEvent, setSelectedEvent] = useState<EventCategory>('l');
  const [imageHostTab, setImageHostTab] = useState<'github' | 'imgbb'>('github');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const sidebarItems = UI_COPY[locale].docs.sidebar;
  const isFr = locale === 'fr';

  const handleCopy = (text: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedCmd(text);
        window.setTimeout(() => setCopiedCmd(null), 1600);
      })
      .catch(() => {});
  };

  return (
    <div className="max-w-[1320px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 lg:py-12 flex-1 animate-fade-in-up">
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 lg:gap-12">
        {/* Sidebar (Sticky on Desktop, Horizontal Tab Strip on Mobile) */}
        <aside className="md:w-60 shrink-0">
          <div className="md:sticky md:top-24">
            <nav
              aria-label={isFr ? 'Sections de documentation' : 'Documentation sections'}
              className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0"
            >
              {sidebarItems.map((item) => {
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    className={`min-h-[44px] text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                      active
                        ? 'text-[#F2F3F5] bg-[#2b2d31] border-[#8c935d]/60'
                        : 'text-[#b9bbbe] hover:text-[#F2F3F5] hover:bg-white/[0.04] border-transparent'
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
        <div className="hidden md:block w-px bg-white/[0.08] shrink-0" aria-hidden="true" />

        {/* Content Area - Spacious on Mobile & Desktop */}
        <main className="flex-1 min-w-0 w-full md:max-w-4xl space-y-6 pb-8">
          {activeSection === 'setup' && (
            <section className="space-y-6">
              <div className="space-y-3">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] tracking-tight">
                  {isFr ? 'Configuration (Setup)' : 'Configuration (Setup)'}
                </h1>
                <p className="text-base text-[#b9bbbe] leading-relaxed">
                  {isFr
                    ? "Logoto automatise le changement de logo, de nom, de bannière et d'image d'invitation de votre serveur Discord, sans nécessiter de base de données externe."
                    : "Logoto automates your Discord server's icon, name, banner, and invite image changes with zero external database or complex setup."}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <h2 className="font-display text-xl font-bold text-[#a3ab72] pb-2 border-b border-white/[0.08]">
                  {isFr ? 'Premiers pas' : 'Getting Started'}
                </h2>
                <p className="text-[15px] sm:text-base text-[#b9bbbe]">
                  {isFr
                    ? 'Lancez simplement la commande de configuration initiale sur votre serveur :'
                    : 'Run the initial setup command on your Discord server:'}
                </p>
                <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <code className="inline-block bg-[#1e1f22] border border-white/10 px-2.5 py-1 rounded text-sm font-mono text-[#a3ab72] font-semibold">
                      /setup
                    </code>
                    <p className="text-sm sm:text-[15px] text-[#F2F3F5]/90 leading-relaxed">
                      {isFr
                        ? 'Crée automatiquement la catégorie privée Logoto, le salon #log-logoto et configure votre langue et votre fuseau horaire.'
                        : 'Automatically creates the private Logoto category, #log-logoto channel, and sets your language and timezone.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('/setup')}
                    className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[#1e1f22] hover:bg-[#313338] border border-white/10 text-xs font-semibold text-[#F2F3F5] cursor-pointer shrink-0 self-start sm:self-center"
                  >
                    {copiedCmd === '/setup' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#43b581]" />
                        <span>{isFr ? 'Copié' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#b9bbbe]" />
                        <span>{isFr ? 'Copier' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[#2b2d31] border border-[#8c935d]/40 p-5 sm:p-6 space-y-3 text-[15px] text-[#F2F3F5]/90 leading-relaxed">
                <p className="font-semibold text-[#a3ab72]">
                  {isFr ? 'Note importante : conservation de #log-logoto' : 'Important: keep #log-logoto'}
                </p>
                <p className="text-[#b9bbbe]">
                  {isFr
                    ? 'Le salon nommé log-logoto doit impérativement exister sur votre serveur pour assurer le suivi technique et la configuration du fuseau horaire.'
                    : 'The log-logoto channel must remain on your server to store your timezone/language configuration and receive execution logs.'}
                </p>
                <p className="text-[#b9bbbe]">
                  {isFr
                    ? "Le bot utilise le sujet de ce salon pour enregistrer sa configuration (tz=...;lang=...) et publie ses comptes-rendus uniquement les jours où un changement programmé s'exécute."
                    : 'The bot uses this channel topic to store configuration (tz=...;lang=...) and posts execution summaries only on days when a scheduled event runs.'}
                </p>
              </div>
            </section>
          )}

          {activeSection === 'how-it-works' && (
            <section className="space-y-6">
              <div className="space-y-3">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] tracking-tight">
                  {isFr ? 'Fonctionnement Général' : 'General Operation'}
                </h1>
                <p className="text-base text-[#b9bbbe] leading-relaxed">
                  {isFr
                    ? 'Logoto lit de manière autonome les salons textuels de votre catégorie privée Logoto pour planifier et exécuter vos mises à jour visuelles.'
                    : 'Logoto autonomously reads the text channels inside your private Logoto category to schedule and apply your visual updates.'}
                </p>
              </div>

              <div className="rounded-xl bg-[#2b2d31] border border-[#8c935d]/40 p-5 sm:p-6 text-[15px] leading-relaxed space-y-1.5">
                <p className="font-semibold text-[#a3ab72]">
                  {isFr ? 'Planification à 00h00 heure locale' : 'Midnight local execution'}
                </p>
                <p className="text-[#b9bbbe]">
                  {isFr
                    ? 'Toutes les mises à jour s’exécutent chaque jour à 00h00 dans le fuseau horaire défini pour votre serveur (modifiable via /settings ou le Dashboard).'
                    : 'All scheduled updates trigger daily at 00:00 in your server’s configured timezone (adjustable anytime via /settings or the Web Dashboard).'}
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="font-display text-xl font-bold text-[#a3ab72] pb-2 border-b border-white/[0.08]">
                  {isFr ? 'Règles de priorité et limites' : 'Priority Rules and Limits'}
                </h2>
                <p className="text-[15px] text-[#b9bbbe]">
                  {isFr
                    ? "Pour garantir la stabilité du serveur et respecter les quotas de l'API Discord, Logoto applique trois règles :"
                    : 'To keep your server stable and respect Discord API rate limits, Logoto enforces three rules:'}
                </p>
                <ol className="space-y-3">
                  {[
                    {
                      num: '01',
                      title: isFr ? 'Un seul changement par type et par jour' : 'One change per type per day',
                      desc: isFr
                        ? "Le nom du serveur peut changer une fois par jour, le logo une fois, la bannière une fois, et le fond d'invitation une fois."
                        : 'The server name can change once per day, the logo once, the banner once, and the invite splash once.',
                    },
                    {
                      num: '02',
                      title: isFr ? 'Modifications simultanées autorisées' : 'Simultaneous changes supported',
                      desc: isFr
                        ? 'Vous pouvez changer le logo ET le nom (ou tout autre élément) le même jour. Toutes les actions s’exécuteront à minuit.'
                        : 'You can update the icon AND name (or any combination of assets) on the same day. All scheduled changes run together.',
                    },
                    {
                      num: '03',
                      title: isFr ? 'Priorité visuelle en cas de doublon' : 'Visual priority for duplicates',
                      desc: isFr
                        ? 'Si plusieurs salons existent pour le même élément le même jour (ex : deux salons l-25-12), le salon situé le plus haut dans la catégorie prime.'
                        : 'If multiple channels exist for the same asset type on the same day, the channel positioned highest in the category list takes precedence.',
                    },
                  ].map((rule) => (
                    <li
                      key={rule.num}
                      className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-5 flex gap-4"
                    >
                      <span className="font-mono text-xs font-bold text-[#a3ab72] pt-1 tabular-nums shrink-0">
                        {rule.num}
                      </span>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-[#F2F3F5] text-base">{rule.title}</h3>
                        <p className="text-sm sm:text-[15px] text-[#b9bbbe] leading-relaxed">
                          {rule.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {activeSection === 'timezone' && (
            <section className="space-y-6">
              <div className="space-y-3">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] tracking-tight">
                  {isFr ? 'Fuseau Horaire (Timezone)' : 'Timezone Configuration'}
                </h1>
                <p className="text-base text-[#b9bbbe] leading-relaxed">
                  {isFr
                    ? "Par défaut, Logoto déclenche les modifications du serveur à 00h00 UTC. Vous pouvez choisir un fuseau IANA (avec gestion automatique de l'heure d'été) ou un décalage fixe UTC± lors de /setup ou via /settings."
                    : 'By default, Logoto triggers server updates at 00:00 UTC. You can select an IANA timezone (with automatic Daylight Saving Time) or a fixed UTC± offset during /setup or via /settings.'}
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-xl font-bold text-[#a3ab72] pb-2 border-b border-white/[0.08]">
                  {isFr ? 'Formats acceptés' : 'Accepted Formats'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-5 space-y-3">
                    <h3 className="font-semibold text-[#F2F3F5] text-sm">
                      {isFr ? 'Fuseaux IANA (Recommandé)' : 'IANA Timezones (Recommended)'}
                    </h3>
                    <div className="flex flex-wrap gap-2 font-mono text-xs text-[#a3ab72]">
                      {['Europe/Paris', 'Europe/London', 'America/Toronto', 'America/New_York', 'UTC'].map(
                        (tz) => (
                          <code
                            key={tz}
                            className="bg-[#1e1f22] px-2.5 py-1 rounded border border-white/[0.06]"
                          >
                            {tz}
                          </code>
                        )
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-5 space-y-3">
                    <h3 className="font-semibold text-[#F2F3F5] text-sm">
                      {isFr ? 'Décalages fixes UTC±' : 'Fixed UTC± Offsets'}
                    </h3>
                    <div className="flex flex-wrap gap-2 font-mono text-xs text-[#a3ab72]">
                      {['UTC+1', 'UTC+2', 'UTC-5', '+5:30'].map((offset) => (
                        <code
                          key={offset}
                          className="bg-[#1e1f22] px-2.5 py-1 rounded border border-white/[0.06]"
                        >
                          {offset}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[#2b2d31] border border-[#8c935d]/40 p-5 sm:p-6 text-[15px] text-[#b9bbbe] leading-relaxed">
                <strong className="text-[#a3ab72] block mb-1">
                  {isFr ? "Exemple d'utilisation" : 'Usage example'}
                </strong>
                {isFr
                  ? "Pour que les événements de votre serveur se déclenchent à l'heure française toute l'année (hiver comme été), choisissez Europe/Paris dans /setup, /settings ou sur le Dashboard Web."
                  : 'To trigger your server events at Paris local time year-round (including DST), select Europe/Paris in /setup, /settings, or the Web Dashboard.'}
              </div>
            </section>
          )}

          {activeSection === 'commands' && (
            <section className="space-y-6">
              <div className="space-y-3">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] tracking-tight">
                  {isFr ? 'Les Commandes du Bot Logoto' : 'Logoto Bot Commands'}
                </h1>
                <p className="text-base text-[#b9bbbe] leading-relaxed">
                  {isFr
                    ? 'Liste complète des commandes slash intégrées à Logoto :'
                    : 'Complete list of slash commands built into Logoto:'}
                </p>
              </div>

              <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] divide-y divide-white/[0.08]">
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
                  <div
                    key={item.cmd}
                    className="p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5"
                  >
                    <code className="bg-[#1e1f22] border border-white/10 px-2.5 py-1 rounded text-xs sm:text-sm font-mono font-bold text-[#a3ab72] shrink-0 self-start">
                      {item.cmd}
                    </code>
                    <p className="text-[15px] text-[#b9bbbe] leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeSection === 'events' && (
            <section className="space-y-6">
              <div className="space-y-3">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] tracking-tight">
                  {isFr ? 'Ajouter un événement' : 'Add a Scheduled Event'}
                </h1>
                <p className="text-base text-[#b9bbbe] leading-relaxed">
                  {isFr
                    ? 'Depuis /settings ou le Dashboard, créez un salon au format {type}-{jour}-{mois}. Sélectionnez un type ci-dessous :'
                    : 'In /settings or the Web Dashboard, create a channel named {type}-{day}-{month}. Select an event type below:'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                      className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#8c935d]/15 border-[#a3ab72]'
                          : 'bg-[#2b2d31] border-white/[0.08] hover:border-[#8c935d]/50'
                      }`}
                    >
                      <h2
                        className={`font-display text-base font-bold mb-1 ${
                          active ? 'text-[#a3ab72]' : 'text-[#F2F3F5]'
                        }`}
                      >
                        {card.title}
                      </h2>
                      <p className="text-sm text-[#b9bbbe]">{card.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl bg-[#2b2d31] border border-[#8c935d]/40 p-5 sm:p-6 space-y-4 text-[15px] text-[#b9bbbe]">
                {selectedEvent === 'l' && (
                  <>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#F2F3F5]">
                      {isFr ? 'Configuration du Logo Automatique' : 'Automatic Logo Configuration'}
                    </h3>
                    <ol className="list-decimal pl-5 space-y-2.5">
                      <li>
                        <strong className="text-[#F2F3F5]">
                          {isFr ? 'Format du salon :' : 'Channel format:'}
                        </strong>{' '}
                        <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[#a3ab72]">
                          l-[JOUR]-[MOIS]
                        </code>{' '}
                        ({isFr ? 'ex :' : 'e.g.'}{' '}
                        <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[#F2F3F5]">
                          l-25-12
                        </code>
                        )
                      </li>
                      <li>
                        <strong className="text-[#F2F3F5]">
                          {isFr ? 'Taille recommandée :' : 'Recommended size:'}
                        </strong>{' '}
                        {isFr
                          ? 'Carré parfait de 512 × 512 pixels (.png, .jpg, .jpeg ou .gif via URL HTTPS permanente).'
                          : '512 × 512 px square (.png, .jpg, .jpeg, or .gif via permanent HTTPS URL).'}
                      </li>
                      <li>
                        <strong className="text-[#F2F3F5]">
                          {isFr ? 'Planification :' : 'Scheduling:'}
                        </strong>{' '}
                        {isFr
                          ? "Via /settings → Créer un événement, via le Dashboard Web, ou en collant l'URL permanente dans le sujet du salon."
                          : 'Via /settings → Create event, the Web Dashboard, or by placing the permanent image URL in the channel topic.'}
                      </li>
                    </ol>
                  </>
                )}

                {selectedEvent === 'n' && (
                  <>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#F2F3F5]">
                      {isFr ? 'Configuration du Nom Automatique' : 'Automatic Name Configuration'}
                    </h3>
                    <ol className="list-decimal pl-5 space-y-2.5">
                      <li>
                        <strong className="text-[#F2F3F5]">
                          {isFr ? 'Format du salon :' : 'Channel format:'}
                        </strong>{' '}
                        <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[#a3ab72]">
                          n-[JOUR]-[MOIS]
                        </code>{' '}
                        ({isFr ? 'ex :' : 'e.g.'}{' '}
                        <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[#F2F3F5]">
                          n-1-1
                        </code>
                        )
                      </li>
                      <li>
                        <strong className="text-[#F2F3F5]">
                          {isFr ? 'Valeur attendue :' : 'Expected value:'}
                        </strong>{' '}
                        {isFr
                          ? 'Le nouveau nom complet du serveur (entre 2 et 100 caractères) enregistré dans le sujet du salon.'
                          : 'The new full server name (2 to 100 characters) stored in the channel topic.'}
                      </li>
                    </ol>
                  </>
                )}

                {selectedEvent === 'b' && (
                  <>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#F2F3F5]">
                      {isFr ? 'Configuration de la Bannière Automatique' : 'Automatic Banner Configuration'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#a3ab72]">
                      {isFr
                        ? 'Prérequis : votre serveur doit posséder le Boost Niveau 2+ pour appliquer des bannières personnalisées.'
                        : 'Requirement: your server requires Boost Level 2+ to apply custom server banners.'}
                    </p>
                    <ol className="list-decimal pl-5 space-y-2.5">
                      <li>
                        <strong className="text-[#F2F3F5]">
                          {isFr ? 'Format du salon :' : 'Channel format:'}
                        </strong>{' '}
                        <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[#a3ab72]">
                          b-[JOUR]-[MOIS]
                        </code>{' '}
                        ({isFr ? 'ex :' : 'e.g.'}{' '}
                        <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[#F2F3F5]">
                          b-25-12
                        </code>
                        )
                      </li>
                      <li>
                        <strong className="text-[#F2F3F5]">
                          {isFr ? 'Taille recommandée :' : 'Recommended size:'}
                        </strong>{' '}
                        {isFr
                          ? '960 × 540 pixels (ratio 16:9). Centrez les éléments importants pour éviter les recadrages.'
                          : '960 × 540 pixels (16:9 ratio). Keep key elements centered to avoid cropping.'}
                      </li>
                    </ol>
                  </>
                )}

                {selectedEvent === 'i' && (
                  <>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#F2F3F5]">
                      {isFr
                        ? "Configuration du Fond d'Invitation Automatique"
                        : 'Automatic Invite Splash Configuration'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#a3ab72]">
                      {isFr
                        ? "Prérequis : votre serveur doit posséder le Boost Niveau 1+ pour appliquer une image de fond d'invitation."
                        : 'Requirement: your server requires Boost Level 1+ to apply a custom invite splash.'}
                    </p>
                    <ol className="list-decimal pl-5 space-y-2.5">
                      <li>
                        <strong className="text-[#F2F3F5]">
                          {isFr ? 'Format du salon :' : 'Channel format:'}
                        </strong>{' '}
                        <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[#a3ab72]">
                          i-[JOUR]-[MOIS]
                        </code>{' '}
                        ({isFr ? 'ex :' : 'e.g.'}{' '}
                        <code className="bg-[#1e1f22] px-1.5 py-0.5 rounded text-[#F2F3F5]">
                          i-14-7
                        </code>
                        )
                      </li>
                      <li>
                        <strong className="text-[#F2F3F5]">
                          {isFr ? 'Taille recommandée :' : 'Recommended size:'}
                        </strong>{' '}
                        {isFr
                          ? '1920 × 1080 pixels (ratio standard 16:9) pour un rendu net sur desktop et mobile.'
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
              <div className="space-y-3">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F2F3F5] tracking-tight">
                  {isFr ? "Obtenir un lien d'image persistant" : 'Getting a Persistent Image Link'}
                </h1>
                <p className="text-base text-[#b9bbbe] leading-relaxed">
                  {isFr
                    ? "Pour que Logoto puisse appliquer vos logos, bannières ou images d'invitation à l'avenir, l'URL fournie doit rester accessible de manière permanente. Les liens directs Discord expirent rapidement : utilisez un hébergeur permanent."
                    : 'For Logoto to apply your logos, banners, or invite splashes on future dates, the URL must remain permanently reachable. Because Discord CDN links expire quickly, use a permanent host.'}
                </p>
              </div>

              <div
                role="tablist"
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#2b2d31] border border-white/10"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={imageHostTab === 'github'}
                  onClick={() => setImageHostTab('github')}
                  className={`h-10 px-4 text-xs sm:text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    imageHostTab === 'github'
                      ? 'bg-[#8c935d] text-[#F2F3F5]'
                      : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
                  }`}
                >
                  {isFr ? 'GitHub (Recommandé)' : 'GitHub (Recommended)'}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={imageHostTab === 'imgbb'}
                  onClick={() => setImageHostTab('imgbb')}
                  className={`h-10 px-4 text-xs sm:text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    imageHostTab === 'imgbb'
                      ? 'bg-[#8c935d] text-[#F2F3F5]'
                      : 'text-[#b9bbbe] hover:text-[#F2F3F5]'
                  }`}
                >
                  ImgBB / Imgur
                </button>
              </div>

              {imageHostTab === 'github' ? (
                <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-5 sm:p-6 space-y-5 text-[15px] text-[#b9bbbe] overflow-hidden">
                  <h3 className="font-display text-lg font-bold text-[#F2F3F5]">
                    {isFr ? 'Héberger via GitHub (Ultra-stable)' : 'Host via GitHub (Ultra-stable)'}
                  </h3>
                  <ol className="list-decimal pl-5 space-y-3">
                    <li>
                      <strong className="text-[#F2F3F5]">
                        {isFr ? 'Créez un dépôt public :' : 'Create a public repository:'}
                      </strong>{' '}
                      {isFr
                        ? 'Allez sur GitHub, cliquez sur New repository, nommez-le et cochez "Add a README file".'
                        : 'Go to GitHub, click New repository, name it, and check "Add a README file".'}
                    </li>
                    <li>
                      <strong className="text-[#F2F3F5]">
                        {isFr ? 'Téléversez vos images :' : 'Upload your images:'}
                      </strong>{' '}
                      {isFr
                        ? 'Cliquez sur "Add file" → "Upload files", déposez vos visuels puis validez avec "Commit changes".'
                        : 'Click "Add file" → "Upload files", drop your assets, and click "Commit changes".'}
                    </li>
                    <li>
                      <strong className="text-[#F2F3F5]">
                        {isFr ? "Obtenez l'URL brute (Raw) :" : 'Get the Raw URL:'}
                      </strong>{' '}
                      {isFr
                        ? 'Ouvrez votre image sur GitHub puis cliquez sur "Raw". L’URL doit commencer par :'
                        : 'Open your image on GitHub and click "Raw". The URL should begin with:'}{' '}
                      <code className="inline-block mt-1 bg-[#1e1f22] px-2 py-0.5 rounded text-xs sm:text-sm text-[#a3ab72] break-all">
                        https://raw.githubusercontent.com/...
                      </code>
                    </li>
                  </ol>
                  <div className="rounded-lg bg-[#1e1f22] border border-[#8c935d]/40 p-4 text-xs sm:text-sm space-y-2 overflow-hidden">
                    <strong className="text-[#a3ab72] block">
                      {isFr ? 'Astuce' : 'Tip'}
                    </strong>
                    <p className="text-[#b9bbbe]">
                      {isFr ? 'Remplacez :' : 'Replace:'}
                    </p>
                    <code className="block bg-[#23252a] px-3 py-2 rounded font-mono text-xs text-[#F2F3F5]/80 break-all">
                      {isFr
                        ? 'github.com/utilisateur/depot/blob/main/image.png'
                        : 'github.com/user/repo/blob/main/image.png'}
                    </code>
                    <p className="text-[#b9bbbe]">
                      {isFr ? 'par :' : 'with:'}
                    </p>
                    <code className="block bg-[#23252a] px-3 py-2 rounded font-mono text-xs text-[#a3ab72] break-all">
                      {isFr
                        ? 'raw.githubusercontent.com/utilisateur/depot/main/image.png'
                        : 'raw.githubusercontent.com/user/repo/main/image.png'}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#2b2d31] border border-white/[0.08] p-5 sm:p-6 space-y-4 text-[15px] text-[#b9bbbe]">
                  <h3 className="font-display text-lg font-bold text-[#F2F3F5]">
                    {isFr ? 'Hébergeurs Gratuits (ImgBB / Imgur)' : 'Free Hosts (ImgBB / Imgur)'}
                  </h3>
                  <ol className="list-decimal pl-5 space-y-3">
                    <li>
                      {isFr ? 'Rendez-vous sur ' : 'Visit '}
                      <a
                        href="https://imgbb.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a3ab72] underline inline-flex items-center gap-1"
                      >
                        ImgBB
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>{' '}
                      {isFr ? 'ou ' : 'or '}
                      <a
                        href="https://imgur.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a3ab72] underline inline-flex items-center gap-1"
                      >
                        Imgur
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
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
