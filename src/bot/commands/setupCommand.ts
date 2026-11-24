import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  WebhookType,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type ModalSubmitInteraction,
  type NewsChannel,
  type StringSelectMenuInteraction,
  type TextChannel,
} from 'discord.js';
import { COMMON_TIMEZONES, normalizeLocale, t } from '../i18n/index.js';
import { getSetupSession, setSetupSession, clearSetupSession } from '../interactions/sessionStore.js';
import {
  ensureLogChannel,
  formatConfigTopic,
  getGuildConfig,
  getLocalDateParts,
  isValidTimeZone,
  normalizeTimeZone,
  setGuildConfig,
} from '../services/guildConfigService.js';
import { PRIMARY_COLOR, type SupportedLocale } from '../types.js';
import {
  checkBotGuildPermissions,
  formatLocalDateTimeDisplay,
  hasGuildAdminPermission,
} from '../utils/validators.js';

function buildLangStepPayload(locale: SupportedLocale) {
  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'setupStep1Title'))
    .setDescription(t(locale, 'setupStep1Desc'));

  const select = new StringSelectMenuBuilder()
    .setCustomId('setup:lang')
    .setPlaceholder(t(locale, 'setupLangPlaceholder'))
    .addOptions(
      { label: 'Français (fr)', value: 'fr', emoji: '🇫🇷' },
      { label: 'English (en)', value: 'en', emoji: '🇬🇧' }
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  return { embeds: [embed], components: [row] };
}

function buildTimezoneStepPayload(locale: SupportedLocale) {
  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'setupStep2Title'))
    .setDescription(t(locale, 'setupStep2Desc', { lang: locale.toUpperCase() }));

  const tzMenu = new StringSelectMenuBuilder()
    .setCustomId('setup:tz')
    .setPlaceholder(t(locale, 'setupTzPlaceholder'))
    .addOptions(
      COMMON_TIMEZONES.map((tz) => ({
        label: tz,
        value: normalizeTimeZone(tz) ?? tz,
      }))
    );

  const customBtn = new ButtonBuilder()
    .setCustomId('setup:tz_modal_btn')
    .setLabel(t(locale, 'setupCustomTzBtn'))
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(tzMenu);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(customBtn);
  return { embeds: [embed], components: [row1, row2] };
}

async function findAnnouncementChannelInGuild(targetGuild: Guild): Promise<NewsChannel | null> {
  await targetGuild.channels.fetch().catch(() => null);
  const announcements = Array.from(targetGuild.channels.cache.values()).filter(
    (ch): ch is NewsChannel => ch.type === ChannelType.GuildAnnouncement
  );
  if (announcements.length === 0) return null;

  const preferred = announcements.find((ch) =>
    /annonce|announcement|news|update|logoto/i.test(ch.name)
  );
  return preferred ?? announcements[0];
}

async function resolveAnnouncementChannel(guild: Guild): Promise<NewsChannel | null> {
  const explicitChannelId =
    process.env.SUPPORT_ANNOUNCEMENT_CHANNEL_ID?.trim() ||
    process.env.ANNOUNCEMENT_CHANNEL_ID?.trim() ||
    process.env.ANNOUNCEMENTS_CHANNEL_ID?.trim() ||
    process.env.ANNONCES_CHANNEL_ID?.trim() ||
    process.env.NEWS_CHANNEL_ID?.trim();

  if (explicitChannelId) {
    const fetched = await guild.client.channels.fetch(explicitChannelId).catch(() => null);
    if (fetched && fetched.type === ChannelType.GuildAnnouncement) {
      return fetched;
    }
    if (fetched) {
      console.warn(
        `[Logoto] Announcement channel ${explicitChannelId} has type ${fetched.type}, expected GuildAnnouncement (${ChannelType.GuildAnnouncement}).`
      );
    }
  }

  const supportGuildId = process.env.SUPPORT_GUILD_ID?.trim();
  if (supportGuildId) {
    const supportGuild =
      guild.client.guilds.cache.get(supportGuildId) ??
      (await guild.client.guilds.fetch(supportGuildId).catch(() => null));
    if (supportGuild) {
      const found = await findAnnouncementChannelInGuild(supportGuild);
      if (found) return found;
    }
  }

  const supportInviteRaw =
    process.env.SUPPORT_INVITE_URL?.trim() ||
    process.env.SUPPORT_URL?.trim() ||
    process.env.SUPPORT_SERVER_URL?.trim();
  if (supportInviteRaw) {
    const invite = await guild.client.fetchInvite(supportInviteRaw).catch(() => null);
    if (invite?.guild?.id) {
      const invitedGuild =
        guild.client.guilds.cache.get(invite.guild.id) ??
        (await guild.client.guilds.fetch(invite.guild.id).catch(() => null));
      if (invitedGuild) {
        const found = await findAnnouncementChannelInGuild(invitedGuild);
        if (found) return found;
      }
    }
  }

  const adminChannelIds = [
    process.env.ADMIN_CHANNEL_ID?.trim(),
    process.env.GUILD_LOG_CHANNEL_ID?.trim(),
    process.env.SERVERS_CHANNEL_ID?.trim(),
    process.env.PING_CHANNEL_ID?.trim(),
  ].filter((id): id is string => Boolean(id));

  for (const chId of adminChannelIds) {
    const ch = await guild.client.channels.fetch(chId).catch(() => null);
    if (ch && 'guild' in ch && ch.guild) {
      const found = await findAnnouncementChannelInGuild(ch.guild);
      if (found) return found;
    }
  }

  for (const candidateGuild of guild.client.guilds.cache.values()) {
    if (/logoto/i.test(candidateGuild.name)) {
      const found = await findAnnouncementChannelInGuild(candidateGuild);
      if (found) return found;
    }
  }

  return null;
}

async function followAnnouncementsInLogChannel(
  guild: Guild,
  logChannel: TextChannel
): Promise<boolean> {
  try {
    const announcementChannel = await resolveAnnouncementChannel(guild);
    if (!announcementChannel) {
      console.warn(
        `[Logoto] No announcement channel resolved for /setup in guild ${guild.id} (set SUPPORT_ANNOUNCEMENT_CHANNEL_ID or SUPPORT_GUILD_ID).`
      );
      return false;
    }

    if (announcementChannel.id === logChannel.id) {
      return false;
    }

    const existingWebhooks = await logChannel.fetchWebhooks().catch(() => null);
    const alreadyFollowing = existingWebhooks?.some(
      (wh) =>
        wh.type === WebhookType.ChannelFollower &&
        wh.sourceChannel?.id === announcementChannel.id
    );

    if (alreadyFollowing) {
      return true;
    }

    await announcementChannel.addFollower(logChannel.id, 'Logoto setup announcement subscription');
    return true;
  } catch (err) {
    console.warn(`[Logoto] Failed to follow support announcement channel for guild ${guild.id}:`, err);
    return false;
  }
}

async function finalizeSetup(guild: Guild, locale: SupportedLocale, timezone: string) {
  const normalizedTz = normalizeTimeZone(timezone) ?? timezone;
  const existingConfig = await getGuildConfig(guild);
  const { logChannel } = await ensureLogChannel(guild);
  const todayKey = getLocalDateParts(normalizedTz).dateKey;
  const updated = await setGuildConfig(guild, {
    timezone: normalizedTz,
    locale,
    lastRunDate: existingConfig.lastRunDate ?? todayKey,
  });

  const topic = formatConfigTopic(updated.timezone, updated.locale);
  const summaryEmbed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(updated.locale, 'pinnedSummaryTitle'))
    .setDescription(t(updated.locale, 'pinnedSummaryDesc'))
    .setFooter({ text: t(updated.locale, 'pinnedSummaryFooter', { topic }) })
    .setTimestamp();

  try {
    const sent = await logChannel.send({ embeds: [summaryEmbed] });
    await sent.pin().catch(() => {});
  } catch (err) {
    console.warn(`[Logoto] Could not send/pin summary embed in ${guild.id}:`, err);
  }

  const followed = await followAnnouncementsInLogChannel(guild, logChannel);
  const announcementNote = followed
    ? t(updated.locale, 'setupAnnouncementFollowed', { channel: `<#${logChannel.id}>` })
    : '';

  const localTime = formatLocalDateTimeDisplay(updated.timezone, updated.locale);
  const confirmEmbed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(updated.locale, 'setupCompleteTitle'))
    .setDescription(
      t(updated.locale, 'setupCompleteDesc', {
        lang: updated.locale,
        tz: updated.timezone,
        localTime,
        channel: `<#${logChannel.id}>`,
        announcementNote,
      })
    )
    .setTimestamp();

  return confirmEmbed;
}

export async function handleSetupCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const currentConfig = await getGuildConfig(interaction.guild);
  const initialLocale = currentConfig.logChannel
    ? currentConfig.locale
    : normalizeLocale(interaction.locale);

  if (!hasGuildAdminPermission(interaction.guild, interaction.user.id, interaction.memberPermissions)) {
    await interaction.reply({
      content: t(initialLocale, 'noPermission'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const botPerms = await checkBotGuildPermissions(interaction.guild, initialLocale);
  if (!botPerms.ok) {
    await interaction.reply({
      embeds: [botPerms.embed],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  setSetupSession(interaction.guild.id, interaction.user.id, { locale: initialLocale });
  const payload = buildLangStepPayload(initialLocale);
  await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}

export async function handleSetupInteraction(
  interaction: StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction
): Promise<boolean> {
  if (!interaction.customId.startsWith('setup:')) return false;
  if (!interaction.guild) return true;

  const session = getSetupSession(interaction.guild.id, interaction.user.id);
  const fallbackLocale = session?.locale ?? normalizeLocale(interaction.locale);

  if (!hasGuildAdminPermission(interaction.guild, interaction.user.id, interaction.memberPermissions)) {
    await interaction.reply({
      content: t(fallbackLocale, 'noPermission'),
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const botPerms = await checkBotGuildPermissions(interaction.guild, fallbackLocale);
  if (!botPerms.ok) {
    await interaction.reply({
      embeds: [botPerms.embed],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'setup:lang') {
    const chosenLocale = normalizeLocale(interaction.values[0]);
    setSetupSession(interaction.guild.id, interaction.user.id, { locale: chosenLocale });
    await interaction.update(buildTimezoneStepPayload(chosenLocale));
    return true;
  }

  if (interaction.isButton() && interaction.customId === 'setup:tz_modal_btn') {
    const locale = session?.locale ?? fallbackLocale;
    const modal = new ModalBuilder()
      .setCustomId('setup:tz_modal')
      .setTitle(t(locale, 'setupTzModalTitle'));

    const input = new TextInputBuilder()
      .setCustomId('timezone_input')
      .setLabel(t(locale, 'setupTzModalLabel'))
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Europe/Paris / UTC+1')
      .setRequired(true)
      .setMaxLength(64);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'setup:tz') {
    const locale = session?.locale ?? fallbackLocale;
    const chosenTz = interaction.values[0];
    if (!isValidTimeZone(chosenTz)) {
      await interaction.reply({
        content: t(locale, 'invalidTimezone', { tz: chosenTz }),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    await interaction.deferUpdate();
    const confirmEmbed = await finalizeSetup(interaction.guild, locale, chosenTz);
    clearSetupSession(interaction.guild.id, interaction.user.id);
    await interaction.editReply({ embeds: [confirmEmbed], components: [] });
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'setup:tz_modal') {
    const locale = session?.locale ?? fallbackLocale;
    const rawTz = interaction.fields.getTextInputValue('timezone_input').trim();

    if (!isValidTimeZone(rawTz)) {
      await interaction.reply({
        content: t(locale, 'invalidTimezone', { tz: rawTz }),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    await interaction.deferUpdate();
    const confirmEmbed = await finalizeSetup(interaction.guild, locale, rawTz);
    clearSetupSession(interaction.guild.id, interaction.user.id);
    await interaction.editReply({ embeds: [confirmEmbed], components: [] });
    return true;
  }

  return false;
}
