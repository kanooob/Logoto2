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
import { normalizeLocale, t, type TranslationKey } from '../i18n/index.js';
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

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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

  const envLinks: Array<{ candidates: Array<string | undefined>; labelKey: TranslationKey }> = [
    {
      candidates: [process.env.WEBSITE_URL, process.env.SITE_URL],
      labelKey: 'aboutWebsiteLabel',
    },
    {
      candidates: [
        process.env.SUPPORT_INVITE_URL,
        process.env.SUPPORT_URL,
        process.env.SUPPORT_SERVER_URL,
      ],
      labelKey: 'aboutSupportLabel',
    },
    {
      candidates: [process.env.TERMS_URL, process.env.TOS_URL, process.env.CGU_URL],
      labelKey: 'aboutTermsLabel',
    },
    {
      candidates: [process.env.PRIVACY_URL, process.env.CONFIDENTIALITE_URL],
      labelKey: 'aboutPrivacyLabel',
    },
  ];

  for (const item of envLinks) {
    const raw = item.candidates.find((v) => v && v.trim().length > 0);
    const normalized = normalizeExternalUrl(raw);
    if (normalized) {
      linkItems.push({ label: t(locale, item.labelKey), url: normalized });
    }
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
  if (linkItems.length > 0) {
    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      linkItems.slice(0, 5).map((item) =>
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
