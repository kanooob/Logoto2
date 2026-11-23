import {
  ChannelType,
  EmbedBuilder,
  Events,
  PermissionsBitField,
  type Client,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { normalizeLocale, t } from '../i18n/index.js';
import { botStartedAtUnix, startScheduler } from '../services/schedulerService.js';

function findWelcomeChannel(guild: Guild): TextChannel | null {
  const me = guild.members.me;
  if (!me) return null;

  const canSend = (ch: TextChannel) => {
    const perms = ch.permissionsFor(me);
    return Boolean(
      perms?.has(PermissionsBitField.Flags.ViewChannel) &&
        perms?.has(PermissionsBitField.Flags.SendMessages) &&
        perms?.has(PermissionsBitField.Flags.EmbedLinks)
    );
  };

  if (guild.systemChannel && guild.systemChannel.type === ChannelType.GuildText && canSend(guild.systemChannel)) {
    return guild.systemChannel;
  }

  for (const ch of guild.channels.cache.values()) {
    if (ch.type === ChannelType.GuildText && canSend(ch)) {
      return ch;
    }
  }

  return null;
}

async function sendAdminNotice(client: Client, embed: EmbedBuilder): Promise<void> {
  const adminChannelId = process.env.ADMIN_CHANNEL_ID?.trim();
  if (!adminChannelId) return;

  try {
    const channel = await client.channels.fetch(adminChannelId);
    if (!channel || !channel.isTextBased() || !('send' in channel)) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.warn('[Logoto] Failed to send admin channel notice:', err);
  }
}

export function registerLifecycleEvents(client: Client): void {
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`${readyClient.user.tag} is alive!`);

    const startupEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Logoto — Démarrage')
      .setDescription(`**${readyClient.user.tag}** est connecté et opérationnel.`)
      .addFields(
        { name: 'Serveurs', value: `${readyClient.guilds.cache.size}`, inline: true },
        { name: 'Démarré', value: `<t:${botStartedAtUnix}:R>`, inline: true }
      )
      .setTimestamp();

    await sendAdminNotice(readyClient, startupEmbed);
    startScheduler(readyClient);
  });

  client.on(Events.GuildCreate, async (guild) => {
    try {
      const locale = normalizeLocale(guild.preferredLocale);
      const targetChannel = findWelcomeChannel(guild);

      if (!targetChannel) return;

      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(t(locale, 'welcomeTitle'))
        .setDescription(t(locale, 'welcomeDesc'))
        .setTimestamp();

      const sentMsg = await targetChannel.send({ embeds: [welcomeEmbed] });
      const deepLink = `https://discord.com/channels/${guild.id}/${targetChannel.id}/${sentMsg.id}`;

      try {
        const owner = await guild.fetchOwner();
        await owner.send({
          content: t(locale, 'welcomeDmContent', {
            guild: guild.name,
            link: deepLink,
          }),
        });
      } catch {
        // Owner DMs may be closed; ignore silently
      }
    } catch (err) {
      console.warn(`[Logoto] Error during guildCreate for ${guild.id}:`, err);
    }
  });

  client.on(Events.GuildDelete, async (guild) => {
    try {
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('Logoto — Serveur quitté')
        .setDescription(`Bot enlevé de **${guild.name ?? 'Inconnu'}** (\`${guild.id}\`)`)
        .setTimestamp();

      await sendAdminNotice(client, embed);
    } catch (err) {
      console.warn(`[Logoto] Error during guildDelete for ${guild.id}:`, err);
    }
  });
}
