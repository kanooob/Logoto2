import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { slashCommandDefinitions } from './commands/definitions.js';
import { handleAboutCommand, handleHelpCommand, handlePingCommand } from './commands/infoCommands.js';
import { handleSettingsCommand, handleSettingsInteraction } from './commands/settingsCommand.js';
import { handleSetupCommand, handleSetupInteraction } from './commands/setupCommand.js';
import { registerDebugCommands } from './events/debugCommands.js';
import { registerLifecycleEvents } from './events/lifecycle.js';

async function registerGlobalSlashCommands(token: string, clientId: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), {
    body: slashCommandDefinitions,
  });
  console.log(`[Logoto] Global slash commands registered (${slashCommandDefinitions.length}).`);
}

export async function startDiscordBot(): Promise<Client | null> {
  const token = process.env.TOKEN?.trim();
  const clientId = process.env.CLIENT_ID?.trim();

  if (!token) {
    console.warn(
      '[Logoto] ALERTE: Variable d’environnement TOKEN manquante — le serveur Express reste actif sur GET / mais le bot Discord ne peut pas se connecter.'
    );
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  registerLifecycleEvents(client);
  registerDebugCommands(client);

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        switch (interaction.commandName) {
          case 'setup':
            await handleSetupCommand(interaction);
            break;
          case 'settings':
            await handleSettingsCommand(interaction);
            break;
          case 'ping':
            await handlePingCommand(interaction);
            break;
          case 'help':
            await handleHelpCommand(interaction);
            break;
          case 'about':
            await handleAboutCommand(interaction);
            break;
          default:
            break;
        }
        return;
      }

      if (interaction.isStringSelectMenu() || interaction.isButton() || interaction.isModalSubmit()) {
        const handledSetup = await handleSetupInteraction(interaction);
        if (handledSetup) return;

        await handleSettingsInteraction(interaction);
      }
    } catch (err) {
      console.error('[Logoto] Interaction error:', err);
      try {
        if (interaction.isRepliable()) {
          const msg = 'Une erreur inattendue est survenue lors du traitement de cette interaction.';
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
          }
        }
      } catch {
        // Ignore follow-up failure
      }
    }
  });

  if (clientId) {
    try {
      await registerGlobalSlashCommands(token, clientId);
    } catch (err) {
      console.error('[Logoto] Failed to register global slash commands:', err);
    }
  } else {
    console.warn('[Logoto] ALERTE: CLIENT_ID manquant — enregistrement automatique des commandes slash ignoré.');
  }

  try {
    await client.login(token);
    return client;
  } catch (err) {
    console.error('[Logoto] ALERTE: Échec de connexion à Discord (vérifiez TOKEN) :', err);
    return null;
  }
}
