import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  REST,
  Routes,
  type APIApplicationCommand,
} from 'discord.js';
import { slashCommandDefinitions } from './commands/definitions.js';
import { handleAboutCommand, handleHelpCommand, handlePingCommand } from './commands/infoCommands.js';
import { handleSettingsCommand, handleSettingsInteraction } from './commands/settingsCommand.js';
import { handleSetupCommand, handleSetupInteraction } from './commands/setupCommand.js';
import { handleOwnerPanelInteraction, registerDebugCommands } from './events/debugCommands.js';
import { registerLifecycleEvents } from './events/lifecycle.js';
import { normalizeLocale, t } from './i18n/index.js';
import { getGuildConfig } from './services/guildConfigService.js';

function normalizeCommandSignature(cmd: Record<string, unknown>): string {
  return JSON.stringify({
    name: cmd.name ?? '',
    description: cmd.description ?? '',
    description_localizations: cmd.description_localizations ?? null,
    contexts: Array.isArray(cmd.contexts) ? [...cmd.contexts].sort() : null,
    default_member_permissions: cmd.default_member_permissions ?? null,
    options: cmd.options ?? [],
  });
}

function commandsNeedSync(
  remote: APIApplicationCommand[],
  local: ReadonlyArray<Record<string, unknown>>
): boolean {
  if (remote.length !== local.length) return true;
  const remoteMap = new Map(
    remote.map((cmd) => [cmd.name, normalizeCommandSignature(cmd as unknown as Record<string, unknown>)])
  );
  for (const def of local) {
    const name = String(def.name ?? '');
    if (remoteMap.get(name) !== normalizeCommandSignature(def)) {
      return true;
    }
  }
  return false;
}

async function registerGlobalSlashCommands(token: string, clientId: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    const existing = (await rest.get(
      Routes.applicationCommands(clientId)
    )) as APIApplicationCommand[];
    if (
      Array.isArray(existing) &&
      !commandsNeedSync(existing, slashCommandDefinitions as unknown as Array<Record<string, unknown>>)
    ) {
      console.log(`[Logoto] Global slash commands already up to date (${slashCommandDefinitions.length}).`);
      return;
    }
  } catch {
    // Fallback to PUT if GET inspection fails
  }

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
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      // Needed by settings:import MessageCollector to read .txt attachments in guild channels
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
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
        const handledOwner = await handleOwnerPanelInteraction(interaction);
        if (handledOwner) return;

        const handledSetup = await handleSetupInteraction(interaction);
        if (handledSetup) return;

        await handleSettingsInteraction(interaction);
      }
    } catch (err) {
      console.error('[Logoto] Interaction error:', err);
      try {
        if (interaction.isRepliable()) {
          let locale = normalizeLocale(interaction.locale);
          if (interaction.guild) {
            const cfg = await getGuildConfig(interaction.guild).catch(() => null);
            if (cfg?.logChannel) {
              locale = cfg.locale;
            }
          }
          const msg = t(locale, 'unexpectedError');
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
