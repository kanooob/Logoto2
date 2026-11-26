import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Events,
  PermissionsBitField,
  type Client,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { buildSiteUrls, getConfiguredSiteOrigin } from '../../server/siteDomain.js';
import { normalizeLocale, t } from '../i18n/index.js';
import {
  botStartedAtUnix,
  startScheduler,
  updateBotPresence,
} from '../services/schedulerService.js';
import { PRIMARY_COLOR } from '../types.js';
import { sendOwnerPanelDM } from './debugCommands.js';

const MAIN_CHANNEL_NAME_REGEX = /^(general|général|main|accueil|welcome|chat|discussion|principal)$/i;

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

  const sendableTextChannels = Array.from(guild.channels.cache.values())
    .filter((ch): ch is TextChannel => ch.type === ChannelType.GuildText && canSend(ch))
    .sort((a, b) => a.rawPosition - b.rawPosition);

  if (sendableTextChannels.length === 0) {
    return null;
  }

  const namedMain = sendableTextChannels.find((ch) => MAIN_CHANNEL_NAME_REGEX.test(ch.name));
  return namedMain ?? sendableTextChannels[0];
}

async function sendChannelNotice(
  client: Client,
  channelId: string | undefined,
  payload: string | { embeds: EmbedBuilder[] }
): Promise<void> {
  const targetId = channelId?.trim();
  if (!targetId) return;

  try {
    const channel = await client.channels.fetch(targetId);
    if (!channel || !channel.isTextBased() || !('send' in channel)) return;
    await channel.send(payload);
  } catch (err) {
    console.warn(`[Logoto] Failed to send notice to channel ${targetId}:`, err);
  }
}

async function sendAdminMessage(client: Client, payload: string | { embeds: EmbedBuilder[] }): Promise<void> {
  await sendChannelNotice(client, process.env.ADMIN_CHANNEL_ID, payload);
}

async function sendGuildLogMessage(client: Client, payload: { embeds: EmbedBuilder[] }): Promise<void> {
  const guildLogChannelId =
    process.env.GUILD_LOG_CHANNEL_ID?.trim() ||
    process.env.SERVERS_CHANNEL_ID?.trim() ||
    process.env.ADMIN_CHANNEL_ID?.trim();
  await sendChannelNotice(client, guildLogChannelId, payload);
}

export function registerLifecycleEvents(client: Client): void {
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`${readyClient.user.tag} is alive!`);

    await sendAdminMessage(
      readyClient,
      `🟢 **${readyClient.user.tag}** est en ligne (${readyClient.guilds.cache.size} serveur(s)) — démarré <t:${botStartedAtUnix}:R>.`
    );
    await sendOwnerPanelDM(readyClient);
    startScheduler(readyClient);
  });

  client.on(Events.GuildCreate, async (guild) => {
    updateBotPresence(guild.client);

    let ownerDisplay = guild.ownerId ? `<@${guild.ownerId}> (\`${guild.ownerId}\`)` : 'Inconnu';
    try {
      const owner = await guild.fetchOwner();
      ownerDisplay = `${owner.user.tag} (<@${owner.id}> • \`${owner.id}\`)`;
    } catch {
      // Keep fallback ownerDisplay
    }

    try {
      const createdUnix = Math.floor(guild.createdTimestamp / 1000);
      const joinEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`🟢 Bot ajouté sur un serveur — ${guild.name}`)
        .addFields(
          { name: 'Nom', value: guild.name || 'Inconnu', inline: true },
          { name: 'ID', value: `\`${guild.id}\``, inline: true },
          { name: 'Propriétaire', value: ownerDisplay, inline: false },
          { name: 'Membres', value: `${guild.memberCount ?? 'Inconnu'}`, inline: true },
          {
            name: 'Boosts',
            value: `Niveau ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boost(s))`,
            inline: true,
          },
          { name: 'Langue Discord', value: `\`${guild.preferredLocale}\``, inline: true },
          { name: 'Créé le', value: `<t:${createdUnix}:D> (<t:${createdUnix}:R>)`, inline: true },
          { name: 'Total serveurs', value: `${guild.client.guilds.cache.size}`, inline: true }
        )
        .setTimestamp();

      const iconUrl = guild.iconURL({ size: 256 });
      if (iconUrl) {
        joinEmbed.setThumbnail(iconUrl);
      }

      await sendGuildLogMessage(guild.client, { embeds: [joinEmbed] });
    } catch (err) {
      console.warn(`[Logoto] Failed to log guildCreate for ${guild.id}:`, err);
    }

    try {
      const locale = normalizeLocale(guild.preferredLocale);
      const targetChannel = findWelcomeChannel(guild);

      if (!targetChannel) return;

      const siteOrigin = getConfiguredSiteOrigin();
      const siteUrls = siteOrigin ? buildSiteUrls(siteOrigin, locale) : null;
      const description = siteUrls
        ? `${t(locale, 'welcomeDesc')}\n\n${t(locale, 'welcomeDashboardLine', { url: siteUrls.dashboard })}`
        : t(locale, 'welcomeDesc');

      const welcomeEmbed = new EmbedBuilder()
        .setColor(PRIMARY_COLOR)
        .setTitle(t(locale, 'welcomeTitle'))
        .setDescription(description)
        .setTimestamp();

      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      if (siteUrls) {
        components.push(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel(t(locale, 'welcomeDashboardBtn'))
              .setURL(siteUrls.dashboard)
              .setStyle(ButtonStyle.Link)
          )
        );
      }

      await targetChannel.send({ embeds: [welcomeEmbed], components });
    } catch (err) {
      console.warn(`[Logoto] Error during guildCreate for ${guild.id}:`, err);
    }
  });

  client.on(Events.GuildDelete, async (guild) => {
    updateBotPresence(client);

    try {
      const createdUnix = guild.createdTimestamp
        ? Math.floor(guild.createdTimestamp / 1000)
        : null;

      const leaveEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`🔴 Bot retiré d'un serveur — ${guild.name || 'Inconnu'}`)
        .addFields(
          { name: 'Nom', value: guild.name || 'Inconnu', inline: true },
          { name: 'ID', value: `\`${guild.id}\``, inline: true },
          {
            name: 'Propriétaire',
            value: guild.ownerId ? `<@${guild.ownerId}> (\`${guild.ownerId}\`)` : 'Inconnu',
            inline: false,
          },
          {
            name: 'Membres',
            value: typeof guild.memberCount === 'number' ? String(guild.memberCount) : 'Inconnu',
            inline: true,
          },
          {
            name: 'Boosts',
            value:
              typeof guild.premiumTier === 'number'
                ? `Niveau ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boost(s))`
                : 'Inconnu',
            inline: true,
          },
          ...(createdUnix
            ? [{ name: 'Créé le', value: `<t:${createdUnix}:D> (<t:${createdUnix}:R>)`, inline: true }]
            : []),
          { name: 'Total serveurs restants', value: `${client.guilds.cache.size}`, inline: true }
        )
        .setTimestamp();

      const iconUrl = guild.iconURL?.({ size: 256 });
      if (iconUrl) {
        leaveEmbed.setThumbnail(iconUrl);
      }

      await sendGuildLogMessage(client, { embeds: [leaveEmbed] });
    } catch (err) {
      console.warn(`[Logoto] Error during guildDelete for ${guild.id}:`, err);
    }
  });
}
