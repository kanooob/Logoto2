import type { EventType, SupportedLocale } from '../types.js';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['fr', 'en'] as const;

export const COMMON_TIMEZONES: readonly string[] = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Toronto',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
] as const;

export function normalizeLocale(input?: string | null): SupportedLocale {
  if (!input) return 'en';
  const normalized = input.trim().toLowerCase();
  if (normalized === 'fr' || normalized.startsWith('fr-') || normalized.startsWith('fr_')) {
    return 'fr';
  }
  if (normalized === 'en' || normalized.startsWith('en-') || normalized.startsWith('en_')) {
    return 'en';
  }
  return 'en';
}

const EVENT_TYPE_LABELS: Record<SupportedLocale, Record<EventType, string>> = {
  fr: {
    l: 'Logo (icône)',
    n: 'Nom du serveur',
    b: 'Bannière',
    i: "Image d'invitation (splash)",
  },
  en: {
    l: 'Logo (icon)',
    n: 'Server name',
    b: 'Banner',
    i: 'Invite splash image',
  },
};

const MONTH_NAMES: Record<SupportedLocale, readonly string[]> = {
  fr: [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

export function getEventTypeLabel(locale: SupportedLocale, type: EventType): string {
  return EVENT_TYPE_LABELS[locale][type];
}

export function getMonthName(locale: SupportedLocale, month: number): string {
  return MONTH_NAMES[locale][month - 1] ?? String(month);
}

const MESSAGES = {
  fr: {
    noPermission: "Vous devez être propriétaire du serveur ou disposer de la permission **Administrateur** ou **Gérer le serveur** pour utiliser cette commande.",
    botMissingPermsTitle: "Permissions du bot manquantes",
    botMissingPermsDesc: "Logoto n'a pas toutes les permissions nécessaires pour fonctionner correctement sur ce serveur.\n\n**Permissions manquantes :**\n{missing}\n\nVeuillez accorder ces permissions au rôle du bot (ou dans {channel}) puis réessayez.",
    botMissingMember: "Impossible de vérifier les permissions du bot sur ce serveur. Veuillez réessayer.",
    permManageGuild: "Gérer le serveur (`ManageGuild`)",
    permManageChannels: "Gérer les salons (`ManageChannels`)",
    permViewChannel: "Voir les salons (`ViewChannel`)",
    permSendMessages: "Envoyer des messages (`SendMessages`)",
    permEmbedLinks: "Intégrer des liens (`EmbedLinks`)",
    permScopeServer: "Serveur",
    sessionExpired: "Session expirée ou invalide. Relancez la commande pour continuer.",
    unexpectedError: "Une erreur inattendue est survenue lors du traitement de cette interaction.",
    back: "Retour",
    cancel: "Annuler",
    confirm: "Confirmer",

    // Setup
    setupStep1Title: "Configuration de Logoto — Étape 1/2 : Langue",
    setupStep1Desc: "Choisissez la langue utilisée par Logoto pour les messages, embeds et journaux sur ce serveur.",
    setupLangPlaceholder: "Sélectionnez une langue",
    setupStep2Title: "Configuration de Logoto — Étape 2/2 : Fuseau horaire",
    setupStep2Desc: "Langue sélectionnée : **{lang}**.\nSélectionnez un fuseau horaire IANA courant ci-dessous (recommandé pour l'heure d'été) ou saisissez un fuseau **IANA** ou décalage fixe **UTC±** manuellement (ex. `Europe/Paris`, `UTC+1`).",
    setupTzPlaceholder: "Choisissez un fuseau horaire IANA",
    setupCustomTzBtn: "Saisir un fuseau / UTC±",
    setupTzModalTitle: "Fuseau horaire personnalisé",
    setupTzModalLabel: "Fuseau IANA (recommandé) ou UTC± fixe",
    invalidTimezone: "Le fuseau horaire `{tz}` est invalide. Utilisez un identifiant IANA valide (`Europe/Paris`, `America/Montreal`, `UTC`) ou un décalage `UTC±` (`UTC+1`, `UTC-5`, `+2`, `+5:30`).",
    setupCompleteTitle: "Logoto configuré avec succès",
    setupCompleteDesc: "La structure de configuration est prête.\n\n**Langue** : `{lang}`\n**Fuseau horaire** : `{tz}`\n**Heure locale actuelle** : `{localTime}`\n**Salon de configuration** : {channel}{announcementNote}\n\nUtilisez `/settings` pour ajouter et gérer vos événements programmés.",
    setupAnnouncementFollowed: "\n**Annonces** : Salon des annonces suivi dans {channel}",
    pinnedSummaryTitle: "Configuration Logoto initialisée",
    pinnedSummaryDesc:
      "Ce salon stocke la configuration de Logoto dans son sujet (`tz=...;lang=...`) et reçoit les journaux d'exécution.\n\n" +
      "⚠️ **Important :**\n" +
      "• Ne renommez pas et ne supprimez pas la catégorie `Logoto` ni le salon `log-logoto`.\n" +
      "• Utilisez `/settings` pour modifier le fuseau horaire, la langue ou vos événements programmés.",
    pinnedSummaryFooter: "Configuration active : {topic}",

    // Settings
    settingsTitle: "Paramètres Logoto — {guild}",
    settingsDesc:
      "**Fuseau horaire** : `{tz}`\n" +
      "**Langue** : `{lang}`\n" +
      "**Date et heure locales** : `{localTime}`",
    settingsEventsField: "Événements programmés ({count})",
    settingsNoEvents: "Aucun événement programmé pour le moment. Cliquez sur **Créer un événement** pour commencer.",
    settingsBtnTimezone: "Fuseau horaire",
    settingsBtnLanguage: "Langue",
    settingsBtnCreateEvent: "Créer un événement",
    settingsBtnManageEvent: "Modifier / Supprimer",
    settingsBtnExport: "Exporter",
    settingsBtnImport: "Importer",
    settingsNotConfigured: "Logoto n'est pas encore initialisé sur ce serveur (ou `log-logoto` est manquant). Lancez `/setup` ou utilisez les contrôles ci-dessous pour configurer.",
    settingsTzTitle: "Modifier le fuseau horaire",
    settingsTzDesc: "Fuseau actuel : `{tz}`\nChoisissez un fuseau IANA ci-dessous (gère l'heure d'été) ou saisissez un identifiant **IANA** ou décalage fixe **UTC±** (ex. `Europe/Paris`, `UTC+1`).",
    settingsLangTitle: "Modifier la langue",
    settingsLangDesc: "Langue actuelle : `{lang}`\nChoisissez la nouvelle langue du serveur.",

    // Create Event
    createEventTitle: "Créer un événement programmé",
    createEventDesc:
      "Sélectionnez le **type**, le **mois** et saisissez le **jour** (1 à 31), puis indiquez la valeur.\n\n" +
      "**Type** : {type}\n" +
      "**Date** : {date}\n" +
      "**Salon cible** : `{channelName}`",
    createEventSelectType: "1. Type de modification",
    createEventSelectMonth: "2. Mois (1-12)",
    createEventDayBtn: "Choisir le jour (1-31)",
    dayModalTitle: "Choisir le jour",
    dayModalLabel: "Jour du mois (nombre entier de 1 à 31)",
    invalidDay: "Jour invalide (`{day}`). Veuillez saisir un nombre entier entre **1** et **31**.",
    invalidDayForMonth: "Le jour `{day}` n'existe pas pour le mois de **{month}** (max `{maxDay}`).",
    boostWarningBanner: "⚠️ **Boost requis** : Ce serveur est au niveau **{tier}**. Une **bannière** nécessite le **Boost Niveau 2** pour s'appliquer, mais vous pouvez tout de même enregistrer l'événement.",
    boostWarningSplash: "⚠️ **Boost requis** : Ce serveur est au niveau **{tier}**. Une **image d'invitation (splash)** nécessite le **Boost Niveau 1** pour s'appliquer, mais vous pouvez tout de même enregistrer l'événement.",
    createEventEnterValueBtn: "Saisir la valeur",
    createEventMissingFields: "Veuillez sélectionner un type, un mois et un jour avant de saisir la valeur.",
    eventValueModalTitle: "Valeur de l'événement ({channelName})",
    eventValueModalNameLabel: "Nouveau nom du serveur (2 à 100 caractères)",
    eventValueModalUrlLabel: "URL HTTPS directe de l'image",
    invalidServerName: "Le nom du serveur doit contenir entre 2 et 100 caractères.",
    invalidImageUrl: "L'URL doit commencer par `https://` et pointer vers une adresse publique valide.",
    eventSavedTitle: "Événement enregistré",
    eventSavedCreated: "Le salon {channel} (`{channelName}`) a été créé avec la valeur :\n`{value}`",
    eventSavedUpdated: "Le salon {channel} (`{channelName}`) a été mis à jour avec la valeur :\n`{value}`",

    // Export / Import
    exportTitle: "Exportation des données Logoto",
    exportDesc: "Voici le fichier d'export contenant `{count}` salon(s) au format `nom_du_salon:sujet_du_salon` ainsi que la date de création (`{createdAt}`).",
    importPromptTitle: "Importer un fichier de configuration",
    importPromptDesc:
      "Envoyez votre fichier d'export (`.txt`) en pièce jointe dans ce salon dans les **2 prochaines minutes**.\n\n" +
      "Format attendu : une ligne par salon au format `nom_du_salon:sujet_du_salon`.\n" +
      "Les salons portant le même nom seront combinés en conservant le sujet issu du fichier.",
    importNoChannel: "Impossible d'attendre un fichier dans ce salon.",
    importTimeout: "Délai d'importation expiré (aucun fichier reçu).",
    importCancelled: "Importation annulée.",
    importInvalidFile: "Le fichier fourni est invalide, vide ou trop volumineux (max 512 Ko).",
    importResultTitle: "Importation terminée",
    importResultDesc:
      "**Salons créés** : `{created}`\n" +
      "**Salons combinés / mis à jour** : `{updated}`\n" +
      "**Configuration `log-logoto` mise à jour** : `{configUpdated}`\n" +
      "**Lignes ignorées / invalides** : `{skipped}`",

    // Manage Event
    manageSelectTitle: "Modifier ou supprimer un événement",
    manageSelectDesc: "Sélectionnez un événement existant dans le menu ci-dessous.",
    manageSelectPlaceholder: "Choisir un événement",
    managePrevPage: "Page précédente",
    manageNextPage: "Page suivante",
    manageDetailTitle: "Événement : {channelName}",
    manageDetailDesc:
      "**Salon** : {channel}\n" +
      "**Type** : {type}\n" +
      "**Date** : {date}\n" +
      "**Valeur** : `{value}`",
    manageBtnEditValue: "Modifier la valeur",
    manageBtnEditDateType: "Modifier date / type",
    manageBtnDelete: "Supprimer",
    editDateTypeTitle: "Modifier la date ou le type — {channelName}",
    editDateTypeDesc:
      "Ajustez les sélecteurs ci-dessous puis confirmez le renommage.\n\n" +
      "**Nouveau type** : {type}\n" +
      "**Nouvelle date** : {date}\n" +
      "**Nouveau nom** : `{newName}`",
    editDateTypeConflict: "Un événement `{newName}` existe déjà. Supprimez-le ou choisissez une autre combinaison.",
    editDateTypeSaved: "L'événement a été renommé en {channel} (`{newName}`).",
    deleteConfirmTitle: "Confirmer la suppression",
    deleteConfirmDesc: "Voulez-vous vraiment supprimer l'événement `{channelName}` ({channel}) ? Cette action est irréversible.",
    deleteDoneTitle: "Événement supprimé",
    deleteDoneDesc: "L'événement `{channelName}` a été supprimé avec succès.",

    // Ping / Help / About
    pingTitle: "Pong !",
    pingDesc: "Statut : **En ligne**\nLatence WebSocket : **{ping} ms**",
    helpTitle: "Aide de Logoto",
    helpDesc: "Logoto automatise les changements visuels de votre serveur Discord à des dates précises sans base de données.",
    helpCommandsTitle: "Commandes disponibles",
    helpCommandsValue:
      "• `/setup` — Assistant de configuration initiale (langue, fuseau, salons)\n" +
      "• `/settings` — Gérer le fuseau, la langue et les événements programmés\n" +
      "• `/ping` — Vérifier la latence et l'état du bot\n" +
      "• `/help` — Afficher cette aide\n" +
      "• `/about` — Informations, liens et temps de fonctionnement",
    helpTypesTitle: "Types d'événements ({type}-{jour}-{mois})",
    helpTypesValue:
      "• `l` — **Logo** du serveur (`https://...`)\n" +
      "• `n` — **Nom** du serveur (texte)\n" +
      "• `b` — **Bannière** du serveur (`https://...`, nécessite le niveau de boost requis)\n" +
      "• `i` — **Image d'invitation / Splash** (`https://...`, nécessite le niveau de boost requis)\n\n" +
      "Exemple : `l-25-12` applique un nouveau logo le 25 décembre.",
    helpTzTitle: "Fuseaux horaires (IANA et UTC±)",
    helpTzValue: "Exemples valides : `Europe/Paris`, `Europe/Brussels`, `America/Toronto`, `UTC`, `UTC+1`, `UTC-5`, `+2`, `+5:30`.",
    aboutTitle: "À propos de Logoto",
    aboutDesc: "Logoto modifie automatiquement le logo, le nom, la bannière et l'image d'invitation de votre serveur selon un calendrier stocké directement dans vos salons Discord.",
    aboutUptimeField: "Démarré",
    aboutLinksField: "Liens utiles",
    aboutInviteLabel: "Inviter le bot",
    aboutWebsiteLabel: "Site web",
    aboutSupportLabel: "Serveur support",
    aboutTermsLabel: "Conditions d'utilisation (CGU)",
    aboutPrivacyLabel: "Politique de confidentialité",

    // Scheduler & Lifecycle
    logTriggerTitle: "Déclenchement programmé : `{channelName}`",
    logTriggerDesc: "Application du changement **{type}** pour le `{date}` ({dateKey}, fuseau `{tz}`).",
    logSuccessTitle: "Modification appliquée : `{channelName}`",
    logSuccessDesc: "Le serveur a été mis à jour avec succès (`{value}`).",
    logAppliedTitle: "Modifications appliquées",
    logAppliedTypeName: "Nom",
    logAppliedTypeLogo: "Logo",
    logAppliedTypeBanner: "Bannière",
    logAppliedTypeSplash: "Image d'invitation",
    logErrorTitle: "Échec de la modification : `{channelName}`",
    logErrorDesc: "Impossible d'appliquer `{type}` (`{value}`) :\n```{error}```",
    logErrorBoostHint: "Vérifiez que le serveur dispose du niveau de boost requis, que le bot a la permission `Gérer le serveur` et que l'URL de l'image est accessible.",
    welcomeTitle: "Merci d'avoir ajouté Logoto !",
    welcomeDesc:
      "Logoto permet de programmer automatiquement des changements de **logo**, **nom**, **bannière** et **image d'invitation** selon votre fuseau horaire.\n\n" +
      "Un administrateur ou propriétaire du serveur peut lancer **`/setup`** pour initialiser la configuration.",
  },
  en: {
    noPermission: "You must be the server owner or have **Administrator** or **Manage Server** permission to use this command.",
    botMissingPermsTitle: "Missing Bot Permissions",
    botMissingPermsDesc: "Logoto does not have all the required permissions to operate properly on this server.\n\n**Missing permissions:**\n{missing}\n\nPlease grant these permissions to the bot's role (or in {channel}) and try again.",
    botMissingMember: "Unable to verify bot permissions on this server. Please try again.",
    permManageGuild: "Manage Server (`ManageGuild`)",
    permManageChannels: "Manage Channels (`ManageChannels`)",
    permViewChannel: "View Channels (`ViewChannel`)",
    permSendMessages: "Send Messages (`SendMessages`)",
    permEmbedLinks: "Embed Links (`EmbedLinks`)",
    permScopeServer: "Server",
    sessionExpired: "Session expired or invalid. Please run the command again.",
    unexpectedError: "An unexpected error occurred while processing this interaction.",
    back: "Back",
    cancel: "Cancel",
    confirm: "Confirm",

    // Setup
    setupStep1Title: "Logoto Setup — Step 1/2: Language",
    setupStep1Desc: "Choose the language Logoto will use for messages, embeds, and logs on this server.",
    setupLangPlaceholder: "Select a language",
    setupStep2Title: "Logoto Setup — Step 2/2: Timezone",
    setupStep2Desc: "Selected language: **{lang}**.\nSelect a common IANA timezone below (recommended for Daylight Saving Time) or enter a custom **IANA** or fixed **UTC+/-** offset manually (e.g. `Europe/Paris`, `UTC+1`).",
    setupTzPlaceholder: "Choose an IANA timezone",
    setupCustomTzBtn: "Enter custom timezone / UTC±",
    setupTzModalTitle: "Custom Timezone",
    setupTzModalLabel: "IANA (recommended) or fixed UTC± offset",
    invalidTimezone: "Timezone `{tz}` is invalid. Please provide a valid IANA identifier (`Europe/Paris`, `America/New_York`, `UTC`) or a `UTC±` offset (`UTC+1`, `UTC-5`, `+2`, `+5:30`).",
    setupCompleteTitle: "Logoto configured successfully",
    setupCompleteDesc: "The configuration structure is ready.\n\n**Language**: `{lang}`\n**Timezone**: `{tz}`\n**Current local time**: `{localTime}`\n**Configuration channel**: {channel}{announcementNote}\n\nUse `/settings` to add and manage scheduled events.",
    setupAnnouncementFollowed: "\n**Announcements**: Following announcements in {channel}",
    pinnedSummaryTitle: "Logoto Configuration Initialized",
    pinnedSummaryDesc:
      "This channel stores Logoto's configuration in its topic (`tz=...;lang=...`) and receives execution logs.\n\n" +
      "⚠️ **Important:**\n" +
      "• Do not rename or delete the `Logoto` category or the `log-logoto` channel.\n" +
      "• Use `/settings` to change the timezone, language, or scheduled events.",
    pinnedSummaryFooter: "Active configuration: {topic}",

    // Settings
    settingsTitle: "Logoto Settings — {guild}",
    settingsDesc:
      "**Timezone**: `{tz}`\n" +
      "**Language**: `{lang}`\n" +
      "**Local date & time**: `{localTime}`",
    settingsEventsField: "Scheduled events ({count})",
    settingsNoEvents: "No scheduled events yet. Click **Create event** to get started.",
    settingsBtnTimezone: "Timezone",
    settingsBtnLanguage: "Language",
    settingsBtnCreateEvent: "Create event",
    settingsBtnManageEvent: "Edit / Delete",
    settingsBtnExport: "Export",
    settingsBtnImport: "Import",
    settingsNotConfigured: "Logoto is not initialized on this server yet (or `log-logoto` is missing). Run `/setup` or use the controls below to configure.",
    settingsTzTitle: "Change Timezone",
    settingsTzDesc: "Current timezone: `{tz}`\nChoose an IANA timezone below (supports DST) or enter a custom **IANA** or fixed **UTC±** offset (e.g. `Europe/Paris`, `UTC+1`).",
    settingsLangTitle: "Change Language",
    settingsLangDesc: "Current language: `{lang}`\nSelect the new server language.",

    // Create Event
    createEventTitle: "Create Scheduled Event",
    createEventDesc:
      "Select the **type**, **month**, and enter the **day** (1 to 31), then enter the target value.\n\n" +
      "**Type**: {type}\n" +
      "**Date**: {date}\n" +
      "**Target channel**: `{channelName}`",
    createEventSelectType: "1. Change type",
    createEventSelectMonth: "2. Month (1-12)",
    createEventDayBtn: "Choose day (1-31)",
    dayModalTitle: "Choose Day",
    dayModalLabel: "Day of month (integer from 1 to 31)",
    invalidDay: "Invalid day (`{day}`). Please enter an integer between **1** and **31**.",
    invalidDayForMonth: "Day `{day}` does not exist in **{month}** (max `{maxDay}`).",
    boostWarningBanner: "⚠️ **Boost required**: This server is Boost Level **{tier}**. A **banner** requires **Boost Level 2** to apply, though you can still save this event.",
    boostWarningSplash: "⚠️ **Boost required**: This server is Boost Level **{tier}**. An **invite splash** requires **Boost Level 1** to apply, though you can still save this event.",
    createEventEnterValueBtn: "Enter value",
    createEventMissingFields: "Please select a type, month, and day before entering the value.",
    eventValueModalTitle: "Event Value ({channelName})",
    eventValueModalNameLabel: "New server name (2 to 100 characters)",
    eventValueModalUrlLabel: "Direct HTTPS image URL",
    invalidServerName: "Server name must be between 2 and 100 characters.",
    invalidImageUrl: "URL must start with `https://` and point to a valid public address.",
    eventSavedTitle: "Event saved",
    eventSavedCreated: "Channel {channel} (`{channelName}`) has been created with value:\n`{value}`",
    eventSavedUpdated: "Channel {channel} (`{channelName}`) has been updated with value:\n`{value}`",

    // Export / Import
    exportTitle: "Logoto Data Export",
    exportDesc: "Here is your export file containing `{count}` channel(s) in `channel_name:channel_topic` format with creation date (`{createdAt}`).",
    importPromptTitle: "Import Configuration File",
    importPromptDesc:
      "Send your export file (`.txt`) as an attachment in this channel within the **next 2 minutes**.\n\n" +
      "Expected format: one line per channel as `channel_name:channel_topic`.\n" +
      "Channels with matching names will be combined while keeping the topic from the file.",
    importNoChannel: "Unable to wait for a file in this channel.",
    importTimeout: "Import timed out (no file received).",
    importCancelled: "Import cancelled.",
    importInvalidFile: "The provided file is invalid, empty, or too large (max 512 KB).",
    importResultTitle: "Import Complete",
    importResultDesc:
      "**Channels created**: `{created}`\n" +
      "**Channels combined / updated**: `{updated}`\n" +
      "**`log-logoto` config updated**: `{configUpdated}`\n" +
      "**Skipped / invalid lines**: `{skipped}`",

    // Manage Event
    manageSelectTitle: "Edit or Delete an Event",
    manageSelectDesc: "Select an existing event from the menu below.",
    manageSelectPlaceholder: "Choose an event",
    managePrevPage: "Previous page",
    manageNextPage: "Next page",
    manageDetailTitle: "Event: {channelName}",
    manageDetailDesc:
      "**Channel**: {channel}\n" +
      "**Type**: {type}\n" +
      "**Date**: {date}\n" +
      "**Value**: `{value}`",
    manageBtnEditValue: "Edit value",
    manageBtnEditDateType: "Edit date / type",
    manageBtnDelete: "Delete",
    editDateTypeTitle: "Edit Date or Type — {channelName}",
    editDateTypeDesc:
      "Adjust the selectors below then confirm renaming.\n\n" +
      "**New type**: {type}\n" +
      "**New date**: {date}\n" +
      "**New name**: `{newName}`",
    editDateTypeConflict: "An event named `{newName}` already exists. Delete it first or pick another combination.",
    editDateTypeSaved: "Event has been renamed to {channel} (`{newName}`).",
    deleteConfirmTitle: "Confirm Deletion",
    deleteConfirmDesc: "Are you sure you want to delete event `{channelName}` ({channel})? This cannot be undone.",
    deleteDoneTitle: "Event deleted",
    deleteDoneDesc: "Event `{channelName}` has been deleted.",

    // Ping / Help / About
    pingTitle: "Pong!",
    pingDesc: "Status: **Online**\nWebSocket latency: **{ping} ms**",
    helpTitle: "Logoto Help",
    helpDesc: "Logoto automates visual branding changes for your Discord server on scheduled dates with zero database.",
    helpCommandsTitle: "Available Commands",
    helpCommandsValue:
      "• `/setup` — Initial setup wizard (language, timezone, channels)\n" +
      "• `/settings` — Manage timezone, language, and scheduled events\n" +
      "• `/ping` — Check bot latency and status\n" +
      "• `/help` — Show this help message\n" +
      "• `/about` — Bot info, links, and uptime",
    helpTypesTitle: "Event Types ({type}-{day}-{month})",
    helpTypesValue:
      "• `l` — Server **Logo** (`https://...`)\n" +
      "• `n` — Server **Name** (text)\n" +
      "• `b` — Server **Banner** (`https://...`, requires boost tier)\n" +
      "• `i` — **Invite Splash** (`https://...`, requires boost tier)\n\n" +
      "Example: `l-25-12` updates the server icon on December 25.",
    helpTzTitle: "Timezones (IANA & UTC±)",
    helpTzValue: "Valid examples: `Europe/Paris`, `Europe/London`, `America/New_York`, `UTC`, `UTC+1`, `UTC-5`, `+2`, `+5:30`.",
    aboutTitle: "About Logoto",
    aboutDesc: "Logoto automatically updates your server's icon, name, banner, and invite splash according to a schedule stored directly in Discord channels.",
    aboutUptimeField: "Started",
    aboutLinksField: "Useful Links",
    aboutInviteLabel: "Invite Bot",
    aboutWebsiteLabel: "Website",
    aboutSupportLabel: "Support Server",
    aboutTermsLabel: "Terms of Service",
    aboutPrivacyLabel: "Privacy Policy",

    // Scheduler & Lifecycle
    logTriggerTitle: "Scheduled Trigger: `{channelName}`",
    logTriggerDesc: "Applying **{type}** update for `{date}` ({dateKey}, timezone `{tz}`).",
    logSuccessTitle: "Update Applied: `{channelName}`",
    logSuccessDesc: "Server updated successfully (`{value}`).",
    logAppliedTitle: "Applied modifications",
    logAppliedTypeName: "Name",
    logAppliedTypeLogo: "Logo",
    logAppliedTypeBanner: "Banner",
    logAppliedTypeSplash: "Invite image",
    logErrorTitle: "Update Failed: `{channelName}`",
    logErrorDesc: "Could not apply `{type}` (`{value}`):\n```{error}```",
    logErrorBoostHint: "Check that the server has the required boost tier, the bot has `Manage Server` permission, and the image URL is reachable.",
    welcomeTitle: "Thanks for adding Logoto!",
    welcomeDesc:
      "Logoto lets you automatically schedule **logo**, **name**, **banner**, and **invite splash** updates in your timezone.\n\n" +
      "A server owner or administrator can run **`/setup`** to initialize the configuration.",
  },
} as const;

export type TranslationKey = keyof typeof MESSAGES.fr;

export function t(
  locale: SupportedLocale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const dict = MESSAGES[locale] ?? MESSAGES.en;
  let text: string = dict[key] ?? MESSAGES.en[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
