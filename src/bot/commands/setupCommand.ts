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
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { COMMON_TIMEZONES, normalizeLocale, t } from '../i18n/index.js';
import { getSetupSession, setSetupSession, clearSetupSession } from '../interactions/sessionStore.js';
import {
  ensureLogChannel,
  formatConfigTopic,
  getGuildConfig,
  isValidTimeZone,
  setGuildConfig,
} from '../services/guildConfigService.js';
import type { SupportedLocale } from '../types.js';
import { formatLocalDateTimeDisplay, hasGuildAdminPermission } from '../utils/validators.js';

function buildLangStepPayload(locale: SupportedLocale) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t(locale, 'setupStep1Title'))
    .setDescription(t(locale, 'setupStep1Desc'));

  const select = new StringSelectMenuBuilder()
    .setCustomId('setup:lang')
    .setPlaceholder(t(locale, 'setupLangPlaceholder'))
    .addOptions(
      { label: 'Français (fr)', value: 'fr', emoji: '🇫🇷', default: locale === 'fr' },
      { label: 'English (en)', value: 'en', emoji: '🇬🇧', default: locale === 'en' }
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  return { embeds: [embed], components: [row] };
}

function buildTimezoneStepPayload(locale: SupportedLocale) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t(locale, 'setupStep2Title'))
    .setDescription(t(locale, 'setupStep2Desc', { lang: locale.toUpperCase() }));

  const tzMenu = new StringSelectMenuBuilder()
    .setCustomId('setup:tz')
    .setPlaceholder(t(locale, 'setupTzPlaceholder'))
    .addOptions(
      COMMON_TIMEZONES.map((tz) => ({
        label: tz,
        value: tz,
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

async function finalizeSetup(guild: Guild, locale: SupportedLocale, timezone: string) {
  const { logChannel } = await ensureLogChannel(guild);
  const updated = await setGuildConfig(guild, { timezone, locale });

  const topic = formatConfigTopic(updated.timezone, updated.locale);
  const summaryEmbed = new EmbedBuilder()
    .setColor(0x57f287)
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

  const announcementChannelId = process.env.SUPPORT_ANNOUNCEMENT_CHANNEL_ID?.trim();
  if (announcementChannelId) {
    try {
      const announcementChannel = await guild.client.channels.fetch(announcementChannelId);
      if (announcementChannel && announcementChannel.type === ChannelType.GuildAnnouncement) {
        await announcementChannel.addFollower(logChannel.id, 'Logoto setup announcement subscription');
      }
    } catch (err) {
      console.warn(`[Logoto] Failed to follow support announcement channel for guild ${guild.id}:`, err);
    }
  }

  const localTime = formatLocalDateTimeDisplay(updated.timezone, updated.locale);
  const confirmEmbed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(t(updated.locale, 'setupCompleteTitle'))
    .setDescription(
      t(updated.locale, 'setupCompleteDesc', {
        lang: updated.locale,
        tz: updated.timezone,
        localTime,
        channel: `<#${logChannel.id}>`,
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
      .setPlaceholder('Europe/Paris')
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
