import {
  ChannelType,
  EmbedBuilder,
  Events,
  PermissionsBitField,
  type Client,
  type Message,
} from 'discord.js';
import { buildEventChannelName, listEvents } from '../services/eventService.js';
import { getGuildConfig, getLocalDateParts } from '../services/guildConfigService.js';
import { processDailyEvents } from '../services/schedulerService.js';

async function replySafely(message: Message, content: string | { embeds: EmbedBuilder[] }): Promise<void> {
  try {
    if ('send' in message.channel) {
      await message.channel.send(content);
      return;
    }
  } catch {
    // Fallback to DM if channel send fails
  }
  try {
    await message.author.send(content);
  } catch {
    // Ignore if DMs are closed
  }
}

export function registerDebugCommands(client: Client): void {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;
      const ownerId = process.env.OWNER_ID?.trim();
      if (!ownerId || message.author.id !== ownerId) return;
      if (!message.content.startsWith('!')) return;

      await message.delete().catch(() => {});

      const raw = message.content.slice(1).trim();
      if (!raw) return;
      const parts = raw.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (command === 'help') {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Logoto — Commandes Debug (!)')
          .setDescription(
            [
              '• `!force` — Force l’exécution des événements du jour sur tous les serveurs',
              '• `!channels [guildId]` — Liste les salons d’un serveur',
              '• `!test` — Diagnostic complet sur le serveur courant',
              '• `!say [channelId] <message>` — Envoie un message arbitraire',
              '• `!invite <guildId>` — Crée une invitation permanente sur un serveur cible',
              '• `!help` — Affiche cette aide',
            ].join('\n')
          );
        await replySafely(message, { embeds: [embed] });
        return;
      }

      if (command === 'force') {
        const result = await processDailyEvents(client, { force: true });
        await replySafely(
          message,
          `Exécution forcée terminée : ${result.checkedGuilds} serveur(s) vérifié(s), ${result.queuedEvents} événement(s) traité(s).`
        );
        return;
      }

      if (command === 'channels') {
        const targetGuild = args[0] ? client.guilds.cache.get(args[0]) : message.guild;
        if (!targetGuild) {
          await replySafely(message, 'Serveur introuvable.');
          return;
        }

        const lines = Array.from(targetGuild.channels.cache.values())
          .sort((a, b) => {
            const posA = 'rawPosition' in a ? a.rawPosition : 0;
            const posB = 'rawPosition' in b ? b.rawPosition : 0;
            return posA - posB;
          })
          .slice(0, 40)
          .map((ch) => `• \`${ch.name}\` (\`${ch.id}\`) [${ChannelType[ch.type]}]`);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`Salons de ${targetGuild.name} (${targetGuild.channels.cache.size})`)
          .setDescription(lines.join('\n').slice(0, 4000) || 'Aucun salon');

        await replySafely(message, { embeds: [embed] });
        return;
      }

      if (command === 'test') {
        if (!message.guild) {
          await replySafely(message, 'Cette commande doit être exécutée dans un serveur.');
          return;
        }

        const guild = message.guild;
        const config = await getGuildConfig(guild);
        const dateParts = getLocalDateParts(config.timezone);
        const events = await listEvents(guild);
        const matching = events.filter((e) => e.day === dateParts.day && e.month === dateParts.month);
        const me = guild.members.me;
        const canManageGuild = me?.permissions.has(PermissionsBitField.Flags.ManageGuild) ?? false;
        const canManageChannels = me?.permissions.has(PermissionsBitField.Flags.ManageChannels) ?? false;

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(`Diagnostic Logoto — ${guild.name}`)
          .addFields(
            { name: 'log-logoto', value: config.logChannel ? `<#${config.logChannel.id}>` : 'Absent', inline: true },
            { name: 'Fuseau / Langue', value: `${config.timezone} / ${config.locale}`, inline: true },
            { name: 'Date locale', value: `${dateParts.dateKey} (${dateParts.hour}:${String(dateParts.minute).padStart(2, '0')})`, inline: true },
            { name: 'Permissions bot', value: `ManageGuild: ${canManageGuild}\nManageChannels: ${canManageChannels}`, inline: true },
            { name: 'Événements configurés', value: `${events.length}`, inline: true },
            {
              name: "Événements du jour",
              value:
                matching.length > 0
                  ? matching.map((e) => `\`${buildEventChannelName(e.type, e.day, e.month)}\``).join(', ')
                  : 'Aucun',
              inline: true,
            }
          )
          .setTimestamp();

        await replySafely(message, { embeds: [embed] });
        return;
      }

      if (command === 'say') {
        if (args.length === 0) return;

        let targetChannel = message.channel;
        let text = args.join(' ');

        if (/^\d{17,20}$/.test(args[0]) && args.length >= 2) {
          try {
            const fetched = await client.channels.fetch(args[0]);
            if (fetched && fetched.isTextBased() && 'send' in fetched) {
              targetChannel = fetched;
              text = args.slice(1).join(' ');
            }
          } catch {
            // Treat as plain message in current channel if fetch fails
          }
        }

        if ('send' in targetChannel && text.trim()) {
          await targetChannel.send(text.trim());
        }
        return;
      }

      if (command === 'invite') {
        const targetGuild = args[0] ? client.guilds.cache.get(args[0]) : message.guild;
        if (!targetGuild) {
          await replySafely(message, 'Serveur cible introuvable.');
          return;
        }

        const me = targetGuild.members.me;
        const inviteChannel = targetGuild.channels.cache.find((ch) => {
          if (ch.type !== ChannelType.GuildText) return false;
          if (!me) return false;
          return ch.permissionsFor(me)?.has(PermissionsBitField.Flags.CreateInstantInvite) ?? false;
        });

        if (!inviteChannel || inviteChannel.type !== ChannelType.GuildText) {
          await replySafely(message, `Aucun salon disponible pour créer une invitation sur ${targetGuild.name}.`);
          return;
        }

        const invite = await inviteChannel.createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: true,
          reason: 'Logoto owner debug !invite',
        });

        await replySafely(message, `Invitation permanente pour **${targetGuild.name}** : ${invite.url}`);
      }
    } catch (err) {
      console.error('[Logoto] Debug command error:', err);
    }
  });
}
