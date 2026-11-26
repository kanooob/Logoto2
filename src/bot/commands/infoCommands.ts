import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  OAuth2Scopes,
  PermissionsBitField,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { buildSiteUrls, getConfiguredSiteOrigin } from '../../server/siteDomain.js';
import { normalizeLocale, t } from '../i18n/index.js';
import { getGuildConfig } from '../services/guildConfigService.js';
import { botStartedAtUnix } from '../services/schedulerService.js';
import { PRIMARY_COLOR, type SupportedLocale } from '../types.js';
import { normalizeExternalUrl } from '../utils/validators.js';

async function resolveLocale(interaction: ChatInputCommandInteraction): Promise<SupportedLocale> {
  if (interaction.guild) {
    const config = await getGuildConfig(interaction.guild);
    if (config.logChannel) {
      return config.locale;
    }
  }
  return normalizeLocale(interaction.locale);
}

export async function handlePingCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const locale = await resolveLocale(interaction);
  const ping = Math.max(0, Math.round(interaction.client.ws.ping));

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'pingTitle'))
    .setDescription(t(locale, 'pingDesc', { ping }))
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export async function handleHelpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const locale = await resolveLocale(interaction);

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'helpTitle'))
    .setDescription(t(locale, 'helpDesc'))
    .addFields(
      { name: t(locale, 'helpCommandsTitle'), value: t(locale, 'helpCommandsValue') },
      { name: t(locale, 'helpTypesTitle'), value: t(locale, 'helpTypesValue') },
      { name: t(locale, 'helpTzTitle'), value: t(locale, 'helpTzValue') }
    )
    .setTimestamp();

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  const siteOrigin = getConfiguredSiteOrigin();
  if (siteOrigin) {
    const urls = buildSiteUrls(siteOrigin, locale);
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(t(locale, 'aboutDocsLabel'))
          .setURL(urls.docs)
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setLabel(t(locale, 'aboutDashboardLabel'))
          .setURL(urls.dashboard)
          .setStyle(ButtonStyle.Link)
      )
    );
  }

  await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
}

export async function handleAboutCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const locale = await resolveLocale(interaction);
  const clientId = process.env.CLIENT_ID?.trim() || interaction.client.user?.id || '';

  let inviteUrl = '';
  try {
    if (interaction.client.user) {
      inviteUrl = interaction.client.generateInvite({
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
        permissions: [
          PermissionsBitField.Flags.Administrator,
          PermissionsBitField.Flags.ManageGuild,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageWebhooks,
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      });
    }
  } catch {
    inviteUrl = '';
  }

  if (!inviteUrl && clientId) {
    const perms = (
      PermissionsBitField.Flags.Administrator |
      PermissionsBitField.Flags.ManageGuild |
      PermissionsBitField.Flags.ManageChannels |
      PermissionsBitField.Flags.ManageWebhooks |
      PermissionsBitField.Flags.ViewChannel |
      PermissionsBitField.Flags.SendMessages |
      PermissionsBitField.Flags.EmbedLinks
    ).toString();
    inviteUrl = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&permissions=${perms}&scope=bot%20applications.commands`;
  }

  const linkItems: Array<{ label: string; url: string }> = [];
  if (inviteUrl) {
    linkItems.push({ label: t(locale, 'aboutInviteLabel'), url: inviteUrl });
  }

  const siteOrigin = getConfiguredSiteOrigin();
  const siteUrls = siteOrigin ? buildSiteUrls(siteOrigin, locale) : null;

  const websiteUrl =
    siteUrls?.home ||
    normalizeExternalUrl(process.env.WEBSITE_URL) ||
    normalizeExternalUrl(process.env.SITE_URL);
  if (websiteUrl) {
    linkItems.push({ label: t(locale, 'aboutWebsiteLabel'), url: websiteUrl });
  }

  if (siteUrls) {
    linkItems.push({ label: t(locale, 'aboutDashboardLabel'), url: siteUrls.dashboard });
    linkItems.push({ label: t(locale, 'aboutDocsLabel'), url: siteUrls.docs });
  }

  const supportUrl =
    normalizeExternalUrl(process.env.SUPPORT_INVITE_URL) ||
    normalizeExternalUrl(process.env.SUPPORT_URL) ||
    normalizeExternalUrl(process.env.SUPPORT_SERVER_URL);
  if (supportUrl) {
    linkItems.push({ label: t(locale, 'aboutSupportLabel'), url: supportUrl });
  }

  const termsUrl =
    siteUrls?.cgu ||
    normalizeExternalUrl(process.env.TERMS_URL) ||
    normalizeExternalUrl(process.env.TOS_URL) ||
    normalizeExternalUrl(process.env.CGU_URL);
  if (termsUrl) {
    linkItems.push({ label: t(locale, 'aboutTermsLabel'), url: termsUrl });
  }

  const privacyUrl =
    siteUrls?.privacy ||
    normalizeExternalUrl(process.env.PRIVACY_URL) ||
    normalizeExternalUrl(process.env.CONFIDENTIALITE_URL);
  if (privacyUrl) {
    linkItems.push({ label: t(locale, 'aboutPrivacyLabel'), url: privacyUrl });
  }

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'aboutTitle'))
    .setDescription(t(locale, 'aboutDesc'))
    .addFields({
      name: t(locale, 'aboutUptimeField'),
      value: `<t:${botStartedAtUnix}:R>`,
      inline: true,
    });

  if (interaction.client.user?.displayAvatarURL()) {
    embed.setThumbnail(interaction.client.user.displayAvatarURL());
  }

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < linkItems.length && components.length < 5; i += 5) {
    const chunk = linkItems.slice(i, i + 5);
    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      chunk.map((item) =>
        new ButtonBuilder()
          .setLabel(item.label)
          .setURL(item.url)
          .setStyle(ButtonStyle.Link)
      )
    );
    components.push(linkRow);
  }

  await interaction.reply({ embeds: [embed], components });
}
