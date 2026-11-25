import type { DocSectionId, WebLocale } from './types';

export const ASSETS = {
  emblem: '/src/assets/images/logoto_icon.png',
  autumnBanner: '/src/assets/images/real_autumn_banner.jpg',
  winterBanner: '/src/assets/images/real_winter_banner.jpg',
  eventBanner: '/src/assets/images/real_event_banner.jpg',
} as const;

export const EXTERNAL_LINKS = {
  supportInvite: 'https://discord.com/invite/TPXFVYVnXe',
  githubRepo: 'https://github.com/kanooob/Logoto',
  betterUptime: 'https://logoto.betteruptime.com/',
  discordTerms: 'https://discord.com/terms',
  discordGuidelines: 'https://discord.com/guidelines',
  contactEmail: 'mailto:galaxies9@duck.com',
} as const;

export function buildInviteUrl(clientId = '1431383390162124920'): string {
  const safeId = clientId.trim() || '1431383390162124920';
  return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(safeId)}`;
}

export const UI_COPY = {
  fr: {
    nav: {
      home: 'Accueil',
      dashboard: 'Dashboard',
      docs: 'Documentation',
      support: 'Support',
      legal: 'Légal',
      addBot: 'Ajouter le bot',
    },
    hero: {
      kicker: 'Bot Discord v2 · Sans base de données',
      titleLine1: "Automatisez l'identité visuelle",
      titleLine2: 'de votre serveur Discord',
      subtitle:
        "Programmez à l'avance le logo, le nom, la bannière et l'image d'invitation de votre serveur. Exécution automatique à minuit selon votre fuseau horaire.",
      primaryCta: 'Ajouter à Discord',
      secondaryCta: 'Ouvrir le Dashboard',
      docsLink: 'Lire la documentation',
      serversFallback: 'Actif sur Discord',
      serversPrefix: '',
      serversSuffix: 'serveurs connectés',
      statusOnline: 'En ligne',
      statusOffline: 'Hors ligne',
      statusLabel: 'Bot',
      midnightLabel: 'Exécution 00:00',
      zeroDbLabel: '0 base externe',
    },
    preview: {
      heading: 'Aperçu en direct',
      subheading: 'Simulez le changement de thème à une date programmée',
      logChannel: '#log-logoto',
      presets: [
        {
          id: 'autumn',
          tab: '01 Oct',
          season: 'Automne',
          channel: '#b-1-10',
          serverName: 'Studio Horizon · Automne',
          actionSummary: 'Bannière + Nom mis à jour à 00:00 Europe/Paris',
        },
        {
          id: 'winter',
          tab: '25 Déc',
          season: 'Hiver',
          channel: '#l-25-12',
          serverName: 'Studio Horizon · Hiver',
          actionSummary: 'Icône serveur (512×512) mise à jour à 00:00 Europe/Paris',
        },
        {
          id: 'event',
          tab: '14 Juil',
          season: 'Événement',
          channel: '#i-14-7',
          serverName: 'Studio Horizon · Édition Spéciale',
          actionSummary: "Fond d'invitation (16:9) appliqué à 00:00 Europe/Paris",
        },
      ],
    },
    bento: {
      sectionTitle: 'Conçu pour durer sans infrastructure lourde',
      sectionSubtitle:
        'Toute votre configuration vit directement dans des salons Discord privés. Aucune base de données tierce, aucune fuite de données.',
      cards: {
        nativeTitle: '01. Stockage natif dans Discord',
        nativeDesc:
          'La commande /setup crée une catégorie privée Logoto et le salon #log-logoto. Chaque événement correspond à un simple salon nommé {type}-{jour}-{mois}.',
        assetsTitle: '02. Quatre identités prises en charge',
        assetsDesc:
          'Modifiez séparément ou simultanément chaque composant visuel de votre serveur à la date souhaitée.',
        assetsList: [
          { code: 'l-JJ-MM', label: 'Logo du serveur', spec: '512 × 512 px · Tous serveurs' },
          { code: 'n-JJ-MM', label: 'Nom du serveur', spec: '2 à 100 car. · Tous serveurs' },
          { code: 'b-JJ-MM', label: 'Bannière', spec: '960 × 540 px · Boost Niveau 2+' },
          { code: 'i-JJ-MM', label: "Fond d'invitation", spec: '1920 × 1080 px · Boost Niveau 1+' },
        ],
        tzTitle: '03. Fuseaux horaires IANA & UTC±',
        tzDesc:
          "Déclenchement précis à 00h00 heure locale avec gestion automatique de l'heure d'été (été/hiver).",
        portableTitle: '04. Dashboard Web & Export .txt',
        portableDesc:
          'Gérez vos salons en direct depuis votre navigateur via Discord OAuth2 ou sauvegardez votre calendrier en un fichier texte lisible.',
        portableCta: 'Accéder au Dashboard',
      },
    },
    workflow: {
      title: 'Opérationnel en trois étapes',
      steps: [
        {
          num: '01',
          title: 'Initialisez votre serveur',
          desc: 'Invitez Logoto puis exécutez /setup (ou passez par le Dashboard) pour créer la catégorie privée Logoto et définir votre langue et fuseau horaire.',
        },
        {
          num: '02',
          title: 'Planifiez vos dates',
          desc: 'Ajoutez vos logos, bannières, fonds d’invitation ou noms via /settings ou l’interface web avec aperçu immédiat.',
        },
        {
          num: '03',
          title: 'Automatisation silencieuse',
          desc: 'Chaque jour à 00h00 heure locale, Logoto applique les changements prévus et publie un compte-rendu dans #log-logoto uniquement les jours actifs.',
        },
      ],
    },
    cta: {
      title: 'Prêt à automatiser votre serveur ?',
      subtitle:
        'Ajoutez Logoto en quelques secondes ou consultez la documentation complète des commandes et hébergeurs d’images.',
      primary: 'Ajouter à Discord',
      secondary: 'Documentation',
    },
    features: [
      {
        num: '01',
        title: 'Changements Dynamiques',
        desc: "Planifiez ou déclenchez instantanément la mise à jour de l'identité visuelle de votre serveur selon vos événements, saisons ou besoins.",
      },
      {
        num: '02',
        title: 'Gestion Centralisée',
        desc: "Configurez le nom, l'icône, la bannière et le fond d'invitation depuis un seul endroit. Logoto s'occupe de la synchronisation de A à Z.",
      },
      {
        num: '03',
        title: 'Gain de Temps',
        desc: 'Fini les modifications manuelles répétitives. Offrez à votre communauté une expérience visuelle toujours fraîche, sans effort de modération.',
      },
    ],
    footer: {
      rights: 'Logoto. Tous droits réservés.',
      status: 'Statut',
      github: 'GitHub',
      tos: 'CGU',
      privacy: 'Confidentialité',
    },
    docs: {
      sidebar: [
        { id: 'setup', label: 'Setup' },
        { id: 'how-it-works', label: 'Fonctionnement' },
        { id: 'timezone', label: 'Fuseau horaire' },
        { id: 'commands', label: 'Commandes' },
        { id: 'events', label: 'Ajouter un événement' },
        { id: 'links', label: "Liens d'images" },
      ] as Array<{ id: DocSectionId; label: string }>,
    },
    legal: {
      tosLink: "Conditions d'Utilisation",
      privacyLink: 'Confidentialité',
    },
  },
  en: {
    nav: {
      home: 'Home',
      dashboard: 'Dashboard',
      docs: 'Documentation',
      support: 'Support',
      legal: 'Legal',
      addBot: 'Add Bot',
    },
    hero: {
      kicker: 'Discord Bot v2 · Zero External Database',
      titleLine1: 'Automate your Discord',
      titleLine2: "server's visual identity",
      subtitle:
        'Schedule your server icon, name, banner, and invite splash ahead of time. Automatic midnight updates in your exact local timezone.',
      primaryCta: 'Add to Discord',
      secondaryCta: 'Open Dashboard',
      docsLink: 'Read documentation',
      serversFallback: 'Active on Discord',
      serversPrefix: '',
      serversSuffix: 'connected servers',
      statusOnline: 'Online',
      statusOffline: 'Offline',
      statusLabel: 'Bot',
      midnightLabel: '00:00 Execution',
      zeroDbLabel: '0 external DB',
    },
    preview: {
      heading: 'Live Preview',
      subheading: 'Simulate a scheduled theme transition on your server',
      logChannel: '#log-logoto',
      presets: [
        {
          id: 'autumn',
          tab: 'Oct 01',
          season: 'Autumn',
          channel: '#b-1-10',
          serverName: 'Studio Horizon · Autumn',
          actionSummary: 'Banner + Name updated at 00:00 Europe/Paris',
        },
        {
          id: 'winter',
          tab: 'Dec 25',
          season: 'Winter',
          channel: '#l-25-12',
          serverName: 'Studio Horizon · Winter',
          actionSummary: 'Server icon (512×512) updated at 00:00 Europe/Paris',
        },
        {
          id: 'event',
          tab: 'Jul 14',
          season: 'Special Event',
          channel: '#i-14-7',
          serverName: 'Studio Horizon · Special Edition',
          actionSummary: 'Invite splash (16:9) applied at 00:00 Europe/Paris',
        },
      ],
    },
    bento: {
      sectionTitle: 'Built to run without heavy infrastructure',
      sectionSubtitle:
        'All configuration lives natively inside private Discord channels. No external database, no third-party data retention.',
      cards: {
        nativeTitle: '01. Native Discord Channel Storage',
        nativeDesc:
          'Running /setup creates a private Logoto category and #log-logoto channel. Each scheduled update is a clean {type}-{day}-{month} channel.',
        assetsTitle: '02. Four Supported Identity Assets',
        assetsDesc:
          'Update each visual surface independently or together on any chosen calendar day.',
        assetsList: [
          { code: 'l-DD-MM', label: 'Server Icon', spec: '512 × 512 px · All servers' },
          { code: 'n-DD-MM', label: 'Server Name', spec: '2 to 100 chars · All servers' },
          { code: 'b-DD-MM', label: 'Server Banner', spec: '960 × 540 px · Boost Level 2+' },
          { code: 'i-DD-MM', label: 'Invite Splash', spec: '1920 × 1080 px · Boost Level 1+' },
        ],
        tzTitle: '03. IANA & UTC± Timezones',
        tzDesc:
          'Runs accurately at 00:00 local time with automatic Daylight Saving Time adjustments.',
        portableTitle: '04. Web Dashboard & .txt Backup',
        portableDesc:
          'Manage live Discord channels from your browser via Discord OAuth2 or export/import your full schedule as a plain text file.',
        portableCta: 'Open Dashboard',
      },
    },
    workflow: {
      title: 'Ready in three steps',
      steps: [
        {
          num: '01',
          title: 'Initialize your server',
          desc: 'Invite Logoto and run /setup (or configure from the Web Dashboard) to create the private Logoto category and set language and timezone.',
        },
        {
          num: '02',
          title: 'Schedule your dates',
          desc: 'Create icon, banner, invite splash, or name events via /settings or the Dashboard with instant 1:1 and 16:9 previews.',
        },
        {
          num: '03',
          title: 'Silent automation',
          desc: 'Every day at 00:00 local time, Logoto applies scheduled updates and posts a summary in #log-logoto only on active days.',
        },
      ],
    },
    cta: {
      title: 'Ready to automate your server?',
      subtitle:
        'Add Logoto in seconds or explore the full documentation for slash commands and permanent image hosting.',
      primary: 'Add to Discord',
      secondary: 'Documentation',
    },
    features: [
      {
        num: '01',
        title: 'Dynamic Changes',
        desc: 'Schedule or instantly trigger visual identity updates for your server to match events, seasonal themes, or custom requirements.',
      },
      {
        num: '02',
        title: 'Centralized Setup',
        desc: 'Manage your server name, icon, banner, and invite background from a single place. Logoto handles all synchronization flawlessly.',
      },
      {
        num: '03',
        title: 'Time Saver',
        desc: "No more tedious manual edits. Keep your community's environment looking fresh without increasing moderation workload.",
      },
    ],
    footer: {
      rights: 'Logoto. All rights reserved.',
      status: 'Status',
      github: 'GitHub',
      tos: 'Terms',
      privacy: 'Privacy',
    },
    docs: {
      sidebar: [
        { id: 'setup', label: 'Setup' },
        { id: 'how-it-works', label: 'How it works' },
        { id: 'timezone', label: 'Timezone' },
        { id: 'commands', label: 'Commands' },
        { id: 'events', label: 'Add an event' },
        { id: 'links', label: 'Image links' },
      ] as Array<{ id: DocSectionId; label: string }>,
    },
    legal: {
      tosLink: 'Terms of Service',
      privacyLink: 'Privacy Policy',
    },
  },
} as const satisfies Record<WebLocale, unknown>;
