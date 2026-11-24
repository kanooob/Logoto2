import type { DocSectionId, WebLocale } from './types';

export const ASSETS = {
  emblem: '/src/assets/images/logoto_emblem_1795533019187.jpg',
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
      titleLine1: 'Le meilleur bot Discord',
      titleLine2: "d'automatisation de l'identité visuelle",
      subtitle:
        "Automatisez en un clic le logo, la bannière, l'image d'invitation et le nom de votre serveur Discord.",
      primaryCta: 'Ajouter à Discord',
      secondaryCta: 'En savoir plus',
      serversFallback: 'Utilisé sur plusieurs serveurs',
      serversPrefix: 'Utilisé sur plus de',
      serversSuffix: 'serveurs',
      statusOnline: 'En ligne',
      statusOffline: 'Hors ligne',
      statusLabel: 'Statut du bot',
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
      titleLine1: 'The best Discord bot',
      titleLine2: 'to automate your visual identity',
      subtitle:
        "Automatically update your Discord server's logo, banner, invite image, and name in a single click.",
      primaryCta: 'Add to Discord',
      secondaryCta: 'Learn more',
      serversFallback: 'Used on many servers',
      serversPrefix: 'Used on over',
      serversSuffix: 'servers',
      statusOnline: 'Online',
      statusOffline: 'Offline',
      statusLabel: 'Bot status',
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
