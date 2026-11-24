import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Events,
  ModalBuilder,
  PermissionsBitField,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Client,
  type Guild,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { buildEventChannelName, listEvents } from '../services/eventService.js';
import { getGuildConfig, getLocalDateParts } from '../services/guildConfigService.js';
import { botStartedAtUnix, processDailyEvents } from '../services/schedulerService.js';
import { PRIMARY_COLOR } from '../types.js';
import { truncateValue } from '../utils/validators.js';

const GUILDS_PAGE_SIZE = 25;
const CHANNELS_PAGE_SIZE = 25;
const EVENTS_PAGE_SIZE = 20;

function getOwnerId(): string | null {
  const ownerId = process.env.OWNER_ID?.trim();
  return ownerId || null;
}

function getSortedGuilds(client: Client): Guild[] {
  return Array.from(client.guilds.cache.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  );
}

function buildOwnerHomePayload(client: Client, page = 0) {
  const guilds = getSortedGuilds(client);
  const totalPages = Math.max(1, Math.ceil(guilds.length / GUILDS_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = guilds.slice(safePage * GUILDS_PAGE_SIZE, (safePage + 1) * GUILDS_PAGE_SIZE);

  let totalMembers = 0;
  for (const guild of guilds) {
    totalMembers += guild.memberCount ?? 0;
  }

  const ping = Math.max(0, Math.round(client.ws.ping));
  const botTag = client.user?.tag ?? 'Logoto';

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(`👑 Panel Propriétaire — ${botTag}`)
    .setDescription(
      'Gérez vos serveurs, lancez des exécutions forcées, inspectez les diagnostics, listez les salons, envoyez des messages ou créez des invitations.'
    )
    .addFields(
      { name: 'Statut', value: `🟢 En ligne (${ping} ms)`, inline: true },
      { name: 'Serveurs', value: `${guilds.length}`, inline: true },
      { name: 'Membres totaux', value: `${totalMembers}`, inline: true },
      { name: 'Démarré', value: `<t:${botStartedAtUnix}:R>`, inline: true }
    )
    .setTimestamp();

  if (client.user?.displayAvatarURL()) {
    embed.setThumbnail(client.user.displayAvatarURL());
  }

  const components: Array<ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>> = [];

  if (slice.length > 0) {
    const guildMenu = new StringSelectMenuBuilder()
      .setCustomId('owner:select_guild')
      .setPlaceholder(
        totalPages > 1
          ? `Choisir un serveur (page ${safePage + 1}/${totalPages})`
          : 'Choisir un serveur à gérer'
      )
      .addOptions(
        slice.map((g) => ({
          label: (g.name || 'Serveur sans nom').slice(0, 100),
          description: `${g.memberCount ?? '?'} membres • ID: ${g.id}`.slice(0, 100),
          value: g.id,
        }))
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(guildMenu));
  }

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('owner:force_all')
      .setLabel('Forcer tous les serveurs')
      .setEmoji('⚡')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(guilds.length === 0),
    new ButtonBuilder()
      .setCustomId(`owner:refresh:${safePage}`)
      .setLabel('Actualiser')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );
  components.push(actionRow);

  if (totalPages > 1) {
    const pageRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`owner:guild_page:${safePage - 1}`)
        .setLabel('Page précédente')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId(`owner:guild_page:${safePage + 1}`)
        .setLabel('Page suivante')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1)
    );
    components.push(pageRow);
  }

  return { embeds: [embed], components };
}

async function buildOwnerGuildPayload(guild: Guild) {
  const config = await getGuildConfig(guild);
  const dateParts = getLocalDateParts(config.timezone);
  const events = await listEvents(guild);
  const matching = events.filter((e) => e.day === dateParts.day && e.month === dateParts.month);
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));

  const permCheck = (flag: bigint) => (me?.permissions.has(flag) ? '✅' : '❌');
  const permsSummary = [
    `${permCheck(PermissionsBitField.Flags.ManageGuild)} ManageGuild`,
    `${permCheck(PermissionsBitField.Flags.ManageChannels)} ManageChannels`,
    `${permCheck(PermissionsBitField.Flags.ViewChannel)} ViewChannel`,
    `${permCheck(PermissionsBitField.Flags.SendMessages)} SendMessages`,
    `${permCheck(PermissionsBitField.Flags.EmbedLinks)} EmbedLinks`,
    `${permCheck(PermissionsBitField.Flags.ManageWebhooks)} ManageWebhooks`,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(`🛠️ Serveur — ${guild.name}`)
    .addFields(
      { name: 'ID', value: `\`${guild.id}\``, inline: true },
      { name: 'Propriétaire', value: guild.ownerId ? `<@${guild.ownerId}> (\`${guild.ownerId}\`)` : 'Inconnu', inline: true },
      { name: 'Membres / Boosts', value: `${guild.memberCount ?? '?'} • Niv. ${guild.premiumTier}`, inline: true },
      { name: 'log-logoto', value: config.logChannel ? `<#${config.logChannel.id}>` : 'Absent', inline: true },
      { name: 'Fuseau / Langue', value: `\`${config.timezone}\` / \`${config.locale}\``, inline: true },
      {
        name: 'Date locale',
        value: `${dateParts.dateKey} (${String(dateParts.hour).padStart(2, '0')}:${String(dateParts.minute).padStart(2, '0')})`,
        inline: true,
      },
      { name: 'Permissions bot', value: permsSummary, inline: true },
      { name: 'Événements configurés', value: `${events.length}`, inline: true },
      {
        name: "Événements du jour",
        value:
          matching.length > 0
            ? matching.map((e) => `\`${buildEventChannelName(e.type, e.day, e.month)}\``).join(', ').slice(0, 1000)
            : 'Aucun',
        inline: true,
      }
    )
    .setTimestamp();

  const iconUrl = guild.iconURL({ size: 256 });
  if (iconUrl) {
    embed.setThumbnail(iconUrl);
  }

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`owner:guild_force:${guild.id}`)
      .setLabel('Forcer ce serveur')
      .setEmoji('⚡')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!config.logChannel),
    new ButtonBuilder()
      .setCustomId(`owner:guild_channels:${guild.id}:0`)
      .setLabel('Salons')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`owner:guild_events:${guild.id}:0`)
      .setLabel('Événements')
      .setEmoji('📅')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(events.length === 0),
    new ButtonBuilder()
      .setCustomId(`owner:guild_say_open:${guild.id}:0`)
      .setLabel('Envoyer un message')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`owner:guild_invite:${guild.id}`)
      .setLabel('Créer une invitation')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`owner:guild_view:${guild.id}`)
      .setLabel('Actualiser')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('owner:home')
      .setLabel('Retour')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

function buildGuildChannelsPayload(guild: Guild, page = 0) {
  const sorted = Array.from(guild.channels.cache.values()).sort((a, b) => {
    const posA = 'rawPosition' in a ? a.rawPosition : 0;
    const posB = 'rawPosition' in b ? b.rawPosition : 0;
    return posA - posB;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / CHANNELS_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = sorted.slice(safePage * CHANNELS_PAGE_SIZE, (safePage + 1) * CHANNELS_PAGE_SIZE);

  const lines = slice.map((ch) => `• \`${ch.name}\` (\`${ch.id}\`) [${ChannelType[ch.type]}]`);

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(`📋 Salons de ${guild.name} (${sorted.length})`)
    .setDescription(lines.join('\n').slice(0, 4000) || 'Aucun salon')
    .setFooter({ text: `Page ${safePage + 1}/${totalPages}` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>();
  if (totalPages > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`owner:guild_channels:${guild.id}:${safePage - 1}`)
        .setLabel('Page précédente')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId(`owner:guild_channels:${guild.id}:${safePage + 1}`)
        .setLabel('Page suivante')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1)
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`owner:guild_view:${guild.id}`)
      .setLabel('Retour')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

async function buildGuildEventsPayload(guild: Guild, page = 0) {
  const events = await listEvents(guild);
  const totalPages = Math.max(1, Math.ceil(events.length / EVENTS_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = events.slice(safePage * EVENTS_PAGE_SIZE, (safePage + 1) * EVENTS_PAGE_SIZE);

  const lines = slice.map((ev) => {
    const chName = buildEventChannelName(ev.type, ev.day, ev.month);
    return `• **\`${chName}\`** (\`${ev.channel.id}\`) — ${truncateValue(ev.value, 60)}`;
  });

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(`📅 Événements de ${guild.name} (${events.length})`)
    .setDescription(lines.join('\n').slice(0, 4000) || 'Aucun événement configuré')
    .setFooter({ text: `Page ${safePage + 1}/${totalPages}` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>();
  if (totalPages > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`owner:guild_events:${guild.id}:${safePage - 1}`)
        .setLabel('Page précédente')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId(`owner:guild_events:${guild.id}:${safePage + 1}`)
        .setLabel('Page suivante')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1)
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`owner:guild_view:${guild.id}`)
      .setLabel('Retour')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function buildGuildSayPickerPayload(guild: Guild, page = 0) {
  const me = guild.members.me;
  const sendableChannels = Array.from(guild.channels.cache.values())
    .filter((ch) => {
      if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) return false;
      if (!me) return false;
      const perms = ch.permissionsFor(me);
      return Boolean(
        perms?.has(PermissionsBitField.Flags.ViewChannel) &&
          perms?.has(PermissionsBitField.Flags.SendMessages)
      );
    })
    .sort((a, b) => {
      const posA = 'rawPosition' in a ? a.rawPosition : 0;
      const posB = 'rawPosition' in b ? b.rawPosition : 0;
      return posA - posB;
    });

  const totalPages = Math.max(1, Math.ceil(sendableChannels.length / CHANNELS_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = sendableChannels.slice(safePage * CHANNELS_PAGE_SIZE, (safePage + 1) * CHANNELS_PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(`💬 Envoyer un message — ${guild.name}`)
    .setDescription(
      slice.length > 0
        ? 'Choisissez un salon dans le menu ci-dessous ou saisissez manuellement un ID de salon.'
        : 'Aucun salon accessible trouvé dans le cache. Utilisez la saisie manuelle par ID.'
    )
    .setTimestamp();

  const components: Array<ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>> = [];

  if (slice.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`owner:say_channel_pick:${guild.id}`)
      .setPlaceholder(
        totalPages > 1
          ? `Choisir un salon (page ${safePage + 1}/${totalPages})`
          : 'Choisir un salon cible'
      )
      .addOptions(
        slice.map((ch) => ({
          label: `#${ch.name}`.slice(0, 100),
          description: `ID: ${ch.id}`.slice(0, 100),
          value: ch.id,
        }))
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }

  const btnRow = new ActionRowBuilder<ButtonBuilder>();
  if (totalPages > 1) {
    btnRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`owner:guild_say_open:${guild.id}:${safePage - 1}`)
        .setLabel('Page préc.')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId(`owner:guild_say_open:${guild.id}:${safePage + 1}`)
        .setLabel('Page suiv.')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1)
    );
  }
  btnRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`owner:say_manual_btn:${guild.id}`)
      .setLabel('Saisir un ID de salon')
      .setEmoji('🆔')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`owner:guild_view:${guild.id}`)
      .setLabel('Retour')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
  );
  components.push(btnRow);

  return { embeds: [embed], components };
}

function buildResultBackRow(backCustomId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(backCustomId)
      .setLabel('Retour')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Primary)
  );
}

export async function sendOwnerPanelDM(client: Client): Promise<void> {
  const ownerId = getOwnerId();
  if (!ownerId) return;

  try {
    const owner = await client.users.fetch(ownerId);
    await owner.send(buildOwnerHomePayload(client, 0));
  } catch (err) {
    console.warn('[Logoto] Impossible d’envoyer le panel propriétaire en MP:', err);
  }
}

export function registerDebugCommands(client: Client): void {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;
      if (message.guild) return; // DM only — no prefix commands in servers

      const ownerId = getOwnerId();
      if (!ownerId || message.author.id !== ownerId) return;

      await message.reply(buildOwnerHomePayload(client, 0));
    } catch (err) {
      console.error('[Logoto] Owner DM panel message error:', err);
    }
  });
}

export async function handleOwnerPanelInteraction(
  interaction: StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction
): Promise<boolean> {
  if (!interaction.customId.startsWith('owner:')) return false;

  const ownerId = getOwnerId();
  if (!ownerId || interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'Accès refusé. Ce panel est réservé au propriétaire du bot.',
    });
    return true;
  }

  const client = interaction.client;
  const cid = interaction.customId;

  if (interaction.isButton()) {
    if (cid === 'owner:home') {
      await interaction.update(buildOwnerHomePayload(client, 0));
      return true;
    }

    if (cid.startsWith('owner:refresh:') || cid.startsWith('owner:guild_page:')) {
      const page = Number(cid.split(':')[2] ?? '0');
      await interaction.update(buildOwnerHomePayload(client, Number.isFinite(page) ? page : 0));
      return true;
    }

    if (cid === 'owner:force_all') {
      await interaction.deferUpdate();
      const result = await processDailyEvents(client, { force: true });
      const embed = new EmbedBuilder()
        .setColor(PRIMARY_COLOR)
        .setTitle('⚡ Exécution forcée terminée (tous les serveurs)')
        .setDescription(
          `**Serveurs vérifiés** : \`${result.checkedGuilds}\`\n**Événements traités** : \`${result.queuedEvents}\``
        )
        .setTimestamp();
      await interaction.editReply({
        embeds: [embed],
        components: [buildResultBackRow('owner:home')],
      });
      return true;
    }

    if (cid.startsWith('owner:guild_view:')) {
      const guildId = cid.split(':')[2];
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        await interaction.update(buildOwnerHomePayload(client, 0));
        return true;
      }
      await interaction.update(await buildOwnerGuildPayload(guild));
      return true;
    }

    if (cid.startsWith('owner:guild_force:')) {
      const guildId = cid.split(':')[2];
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        await interaction.update(buildOwnerHomePayload(client, 0));
        return true;
      }
      await interaction.deferUpdate();
      const result = await processDailyEvents(client, { force: true, guildId });
      const embed = new EmbedBuilder()
        .setColor(PRIMARY_COLOR)
        .setTitle(`⚡ Exécution forcée — ${guild.name}`)
        .setDescription(
          `**Serveur vérifié** : \`${result.checkedGuilds}\`\n**Événements traités** : \`${result.queuedEvents}\``
        )
        .setTimestamp();
      await interaction.editReply({
        embeds: [embed],
        components: [buildResultBackRow(`owner:guild_view:${guild.id}`)],
      });
      return true;
    }

    if (cid.startsWith('owner:guild_channels:')) {
      const [, , guildId, rawPage] = cid.split(':');
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        await interaction.update(buildOwnerHomePayload(client, 0));
        return true;
      }
      const page = Number(rawPage ?? '0');
      await interaction.update(buildGuildChannelsPayload(guild, Number.isFinite(page) ? page : 0));
      return true;
    }

    if (cid.startsWith('owner:guild_events:')) {
      const [, , guildId, rawPage] = cid.split(':');
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        await interaction.update(buildOwnerHomePayload(client, 0));
        return true;
      }
      const page = Number(rawPage ?? '0');
      await interaction.update(await buildGuildEventsPayload(guild, Number.isFinite(page) ? page : 0));
      return true;
    }

    if (cid.startsWith('owner:guild_say_open:')) {
      const [, , guildId, rawPage] = cid.split(':');
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        await interaction.update(buildOwnerHomePayload(client, 0));
        return true;
      }
      const page = Number(rawPage ?? '0');
      await interaction.update(buildGuildSayPickerPayload(guild, Number.isFinite(page) ? page : 0));
      return true;
    }

    if (cid.startsWith('owner:say_manual_btn:')) {
      const guildId = cid.split(':')[2];
      const modal = new ModalBuilder()
        .setCustomId(`owner:say_manual_modal:${guildId}`)
        .setTitle('Envoyer un message dans un salon');

      const channelInput = new TextInputBuilder()
        .setCustomId('channel_id')
        .setLabel('ID du salon cible')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('123456789012345678')
        .setRequired(true)
        .setMaxLength(25);

      const messageInput = new TextInputBuilder()
        .setCustomId('message_content')
        .setLabel('Message à envoyer')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput)
      );
      await interaction.showModal(modal);
      return true;
    }

    if (cid.startsWith('owner:guild_invite:')) {
      const guildId = cid.split(':')[2];
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        await interaction.update(buildOwnerHomePayload(client, 0));
        return true;
      }

      const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
      const inviteChannel = guild.channels.cache.find((ch) => {
        if (ch.type !== ChannelType.GuildText) return false;
        if (!me) return false;
        return ch.permissionsFor(me)?.has(PermissionsBitField.Flags.CreateInstantInvite) ?? false;
      });

      if (!inviteChannel || inviteChannel.type !== ChannelType.GuildText) {
        const errEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle(`🔗 Invitation — ${guild.name}`)
          .setDescription('Aucun salon disponible avec la permission `Créer une invitation`.')
          .setTimestamp();
        await interaction.update({
          embeds: [errEmbed],
          components: [buildResultBackRow(`owner:guild_view:${guild.id}`)],
        });
        return true;
      }

      await interaction.deferUpdate();
      try {
        const invite = await inviteChannel.createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: true,
          reason: 'Logoto owner DM panel invite',
        });

        const okEmbed = new EmbedBuilder()
          .setColor(PRIMARY_COLOR)
          .setTitle(`🔗 Invitation permanente — ${guild.name}`)
          .setDescription(`Salon : <#${inviteChannel.id}> (\`${inviteChannel.name}\`)\nLien : ${invite.url}`)
          .setTimestamp();
        await interaction.editReply({
          embeds: [okEmbed],
          components: [buildResultBackRow(`owner:guild_view:${guild.id}`)],
        });
      } catch (err) {
        const errEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle(`🔗 Erreur d'invitation — ${guild.name}`)
          .setDescription(`Impossible de créer l'invitation : \`${err instanceof Error ? err.message : String(err)}\``)
          .setTimestamp();
        await interaction.editReply({
          embeds: [errEmbed],
          components: [buildResultBackRow(`owner:guild_view:${guild.id}`)],
        });
      }
      return true;
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (cid === 'owner:select_guild') {
      const guildId = interaction.values[0];
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        await interaction.update(buildOwnerHomePayload(client, 0));
        return true;
      }
      await interaction.update(await buildOwnerGuildPayload(guild));
      return true;
    }

    if (cid.startsWith('owner:say_channel_pick:')) {
      const guildId = cid.split(':')[2];
      const channelId = interaction.values[0];
      const guild = client.guilds.cache.get(guildId);
      const ch = guild?.channels.cache.get(channelId);

      const modal = new ModalBuilder()
        .setCustomId(`owner:say_modal:${guildId}:${channelId}`)
        .setTitle(`Message → #${(ch?.name ?? channelId).slice(0, 30)}`);

      const input = new TextInputBuilder()
        .setCustomId('message_content')
        .setLabel('Message à envoyer')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return true;
    }
  }

  if (interaction.isModalSubmit()) {
    if (cid.startsWith('owner:say_modal:') || cid.startsWith('owner:say_manual_modal:')) {
      const parts = cid.split(':');
      const isManual = cid.startsWith('owner:say_manual_modal:');
      const guildId = parts[2];
      const channelId = isManual
        ? interaction.fields.getTextInputValue('channel_id').trim()
        : parts[3];
      const text = interaction.fields.getTextInputValue('message_content').trim();

      await interaction.deferUpdate();

      try {
        const fetched = await client.channels.fetch(channelId);
        if (!fetched || !fetched.isTextBased() || !('send' in fetched)) {
          throw new Error('Salon introuvable ou non textuel.');
        }
        await fetched.send(text);

        const okEmbed = new EmbedBuilder()
          .setColor(PRIMARY_COLOR)
          .setTitle('💬 Message envoyé')
          .setDescription(`Le message a été envoyé dans <#${fetched.id}> (\`${fetched.id}\`).`)
          .setTimestamp();

        await interaction.editReply({
          embeds: [okEmbed],
          components: [buildResultBackRow(`owner:guild_view:${guildId}`)],
        });
      } catch (err) {
        const errEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('💬 Échec de l’envoi')
          .setDescription(`Impossible d'envoyer le message : \`${err instanceof Error ? err.message : String(err)}\``)
          .setTimestamp();

        await interaction.editReply({
          embeds: [errEmbed],
          components: [buildResultBackRow(`owner:guild_view:${guildId}`)],
        });
      }
      return true;
    }
  }

  return false;
}
