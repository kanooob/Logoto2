import {
  EmbedBuilder,
  MessageFlags,
  OAuth2Scopes,
  PermissionsBitField,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { normalizeLocale, t } from '../i18n/index.js';
import { getGuildConfig } from '../services/guildConfigService.js';
import { botStartedAtUnix } from '../services/schedulerService.js';
import type { SupportedLocale } from '../types.js';

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
    .setColor(0x57f287)
    .setTitle(t(locale, 'pingTitle'))
    .setDescription(t(locale, 'pingDesc', { ping }))
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export async function handleHelpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const locale = await resolveLocale(interaction);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
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

  const inviteUrl = clientId
    ? interaction.client.generateInvite({
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
        permissions: [
          PermissionsBitField.Flags.ManageGuild,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      })
    : '';

  const linkLines: string[] = [];
  if (inviteUrl) {
    linkLines.push(`• [${t(locale, 'aboutInviteLabel')}](${inviteUrl})`);
  }

  const optionalLinks: Array<[string | undefined, 'aboutWebsiteLabel' | 'aboutSupportLabel' | 'aboutTermsLabel' | 'aboutPrivacyLabel']> = [
    [process.env.WEBSITE_URL, 'aboutWebsiteLabel'],
    [process.env.SUPPORT_INVITE_URL, 'aboutSupportLabel'],
    [process.env.TERMS_URL, 'aboutTermsLabel'],
    [process.env.PRIVACY_URL, 'aboutPrivacyLabel'],
  ];

  for (const [rawUrl, labelKey] of optionalLinks) {
    const clean = rawUrl?.trim();
    if (clean && (clean.startsWith('https://') || clean.startsWith('http://'))) {
      linkLines.push(`• [${t(locale, labelKey)}](${clean})`);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t(locale, 'aboutTitle'))
    .setDescription(t(locale, 'aboutDesc'))
    .addFields({
      name: t(locale, 'aboutUptimeField'),
      value: `<t:${botStartedAtUnix}:R>`,
      inline: true,
    });

  if (linkLines.length > 0) {
    embed.addFields({
      name: t(locale, 'aboutLinksField'),
      value: linkLines.join('\n'),
    });
  }

  if (interaction.client.user?.displayAvatarURL()) {
    embed.setThumbnail(interaction.client.user.displayAvatarURL());
  }

  await interaction.reply({ embeds: [embed] });
}
