import { SlashCommandBuilder } from 'discord.js';

export const slashCommandDefinitions = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure Logoto on this server (language, timezone, channels)')
    .setDescriptionLocalizations({
      fr: 'Configurer Logoto sur ce serveur (langue, fuseau horaire, salons)',
    })
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Manage Logoto timezone, language, and scheduled events')
    .setDescriptionLocalizations({
      fr: 'Gérer le fuseau horaire, la langue et les événements programmés',
    })
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check Logoto WebSocket latency and status')
    .setDescriptionLocalizations({
      fr: 'Vérifier la latence WebSocket et le statut de Logoto',
    }),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show Logoto commands, event types, and timezone examples')
    .setDescriptionLocalizations({
      fr: "Afficher l'aide des commandes, types d'événements et fuseaux IANA",
    }),

  new SlashCommandBuilder()
    .setName('about')
    .setDescription('Show information, useful links, invite link, and uptime')
    .setDescriptionLocalizations({
      fr: 'Afficher les informations, liens utiles, invitation et temps de marche',
    }),
].map((cmd) => cmd.toJSON());
