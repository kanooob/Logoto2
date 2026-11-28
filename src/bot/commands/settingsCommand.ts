import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type MessageCollector,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import {
  COMMON_TIMEZONES,
  getEventTypeLabel,
  getMonthName,
  normalizeLocale,
  t,
} from '../i18n/index.js';
import {
  clearSettingsSession,
  getSettingsSession,
  setSettingsSession,
} from '../interactions/sessionStore.js';
import {
  buildEventChannelName,
  deleteEvent,
  listEvents,
  parseEventChannelName,
  updateEventChannel,
  upsertEvent,
} from '../services/eventService.js';
import {
  canBotManageRoles,
  disableRestoreRole,
  enableRestoreRole,
  findRestoreRole,
  formatConfigTopic,
  getGuildConfig,
  isValidTimeZone,
  normalizeTimeZone,
  parseConfigFromTopic,
  RESTORE_ROLE_NAME,
  setGuildConfig,
  syncRestoreRoleOverwrites,
} from '../services/guildConfigService.js';
import { PRIMARY_COLOR, type EventType, type SupportedLocale } from '../types.js';
import {
  checkBotGuildPermissions,
  formatLocalDateTimeDisplay,
  getBoostRequirementWarning,
  getMaxDaysInMonth,
  hasGuildAdminPermission,
  isSafeImageUrl,
  isValidDayForMonth,
  isValidServerName,
  parseValidDay,
  truncateValue,
} from '../utils/validators.js';

const EVENT_TYPES: readonly EventType[] = ['l', 'n', 'b', 'i'];
const PAGE_SIZE = 25;
const MAX_IMPORT_BYTES = 512 * 1024;
const ALLOWED_DISCORD_CDN_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

const activeImportCollectors = new Map<string, MessageCollector>();

function importKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

async function buildMainSettingsPayload(guild: Guild, fallbackLocale?: SupportedLocale) {
  const config = await getGuildConfig(guild);
  const locale = config.logChannel ? config.locale : fallbackLocale ?? config.locale;
  const events = await listEvents(guild);
  const localTime = formatLocalDateTimeDisplay(config.timezone, locale);

  const lines = events.slice(0, 20).map((ev) => {
    const chName = buildEventChannelName(ev.type, ev.day, ev.month);
    return `• **\`${chName}\`** (<#${ev.channel.id}>) — ${truncateValue(ev.value, 50)}`;
  });

  if (events.length > 20) {
    lines.push(`… (+${events.length - 20})`);
  }

  const warningNote = !config.logChannel ? `\n\n⚠️ ${t(locale, 'settingsNotConfigured')}` : '';
  const restoreStatus = config.restoreRoleEnabled
    ? `✅ ${t(locale, 'settingsRestoreStatusOn', {
        role: config.restoreRoleId ? `<@&${config.restoreRoleId}>` : `\`${RESTORE_ROLE_NAME}\``,
      })}`
    : `❌ ${t(locale, 'settingsRestoreStatusOff')}`;

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'settingsTitle', { guild: guild.name }))
    .setDescription(
      `${t(locale, 'settingsDesc', {
        tz: config.timezone,
        lang: locale,
        localTime,
        restoreStatus,
      })}${warningNote}`
    )
    .addFields({
      name: t(locale, 'settingsEventsField', { count: events.length }),
      value: lines.length > 0 ? lines.join('\n') : t(locale, 'settingsNoEvents'),
    })
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings:menu_tz')
      .setLabel(t(locale, 'settingsBtnTimezone'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('settings:menu_lang')
      .setLabel(t(locale, 'settingsBtnLanguage'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('settings:create_open')
      .setLabel(t(locale, 'settingsBtnCreateEvent'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('settings:manage_open')
      .setLabel(t(locale, 'settingsBtnManageEvent'))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(events.length === 0)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings:export')
      .setLabel(t(locale, 'settingsBtnExport'))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(events.length === 0 && !config.logChannel),
    new ButtonBuilder()
      .setCustomId('settings:import')
      .setLabel(t(locale, 'settingsBtnImport'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('settings:menu_restore')
      .setLabel(t(locale, 'settingsBtnRestore'))
      .setStyle(config.restoreRoleEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

function buildTimezonePayload(locale: SupportedLocale, currentTz: string) {
  const normalizedCurrent = normalizeTimeZone(currentTz) ?? currentTz;
  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'settingsTzTitle'))
    .setDescription(t(locale, 'settingsTzDesc', { tz: currentTz }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('settings:tz_select')
    .setPlaceholder(t(locale, 'setupTzPlaceholder'))
    .addOptions(
      COMMON_TIMEZONES.map((tz) => {
        const value = normalizeTimeZone(tz) ?? tz;
        return {
          label: tz,
          value,
          default: value === normalizedCurrent,
        };
      })
    );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings:tz_modal_btn')
      .setLabel(t(locale, 'setupCustomTzBtn'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('settings:home')
      .setLabel(t(locale, 'back'))
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), buttons],
  };
}

function buildLanguagePayload(locale: SupportedLocale) {
  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'settingsLangTitle'))
    .setDescription(t(locale, 'settingsLangDesc', { lang: locale }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('settings:lang_select')
    .setPlaceholder(t(locale, 'setupLangPlaceholder'))
    .addOptions(
      { label: 'Français (fr)', value: 'fr', emoji: '🇫🇷' },
      { label: 'English (en)', value: 'en', emoji: '🇬🇧' }
    );

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings:home')
      .setLabel(t(locale, 'back'))
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), backRow],
  };
}

async function buildRestoreRolePayload(guild: Guild, locale: SupportedLocale) {
  const config = await getGuildConfig(guild);
  const status = config.restoreRoleEnabled
    ? `✅ ${t(locale, 'settingsRestoreStatusOn', {
        role: config.restoreRoleId ? `<@&${config.restoreRoleId}>` : `\`${RESTORE_ROLE_NAME}\``,
      })}`
    : `❌ ${t(locale, 'settingsRestoreStatusOff')}`;

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'settingsRestoreTitle'))
    .setDescription(t(locale, 'settingsRestoreDesc', { status }));

  const row = new ActionRowBuilder<ButtonBuilder>();
  if (config.restoreRoleEnabled) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('settings:restore_sync')
        .setLabel(t(locale, 'settingsRestoreSyncBtn'))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('settings:restore_disable')
        .setLabel(t(locale, 'settingsRestoreDisableBtn'))
        .setStyle(ButtonStyle.Danger)
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('settings:restore_enable')
        .setLabel(t(locale, 'settingsRestoreEnableBtn'))
        .setStyle(ButtonStyle.Success)
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('settings:home')
      .setLabel(t(locale, 'back'))
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

function buildTypeAndMonthRows(
  locale: SupportedLocale,
  prefix: 'create' | 'editdt',
  selected: { type?: EventType; month?: number }
) {
  const typeMenu = new StringSelectMenuBuilder()
    .setCustomId(`settings:${prefix}_type`)
    .setPlaceholder(t(locale, 'createEventSelectType'))
    .addOptions(
      EVENT_TYPES.map((tp) => ({
        label: `${tp} — ${getEventTypeLabel(locale, tp)}`,
        value: tp,
        default: selected.type === tp,
      }))
    );

  const monthMenu = new StringSelectMenuBuilder()
    .setCustomId(`settings:${prefix}_month`)
    .setPlaceholder(t(locale, 'createEventSelectMonth'))
    .addOptions(
      Array.from({ length: 12 }, (_, idx) => {
        const m = idx + 1;
        return {
          label: `${m} — ${getMonthName(locale, m)}`,
          value: String(m),
          default: selected.month === m,
        };
      })
    );

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(monthMenu),
  ];
}

function buildCreateEventPayload(
  guild: Guild,
  locale: SupportedLocale,
  draft: { type?: EventType; month?: number; day?: number }
) {
  const typeStr = draft.type ? `${draft.type} (${getEventTypeLabel(locale, draft.type)})` : '—';
  const dateStr =
    draft.day && draft.month
      ? `${draft.day} ${getMonthName(locale, draft.month)} (${draft.day}/${draft.month})`
      : draft.day
        ? `${draft.day} / ?`
        : draft.month
          ? `? / ${getMonthName(locale, draft.month)}`
          : '—';
  const chName =
    draft.type && draft.day && draft.month
      ? buildEventChannelName(draft.type, draft.day, draft.month)
      : '—';

  const boostWarning = getBoostRequirementWarning(guild, draft.type, locale);
  const invalidDateWarning =
    draft.day && draft.month && !isValidDayForMonth(draft.day, draft.month)
      ? `⚠️ ${t(locale, 'invalidDayForMonth', {
          day: draft.day,
          month: getMonthName(locale, draft.month),
          maxDay: getMaxDaysInMonth(draft.month),
        })}`
      : null;

  const baseDesc = t(locale, 'createEventDesc', { type: typeStr, date: dateStr, channelName: chName });
  const warnings = [boostWarning, invalidDateWarning].filter((w): w is string => Boolean(w));
  const description = warnings.length > 0 ? `${baseDesc}\n\n${warnings.join('\n\n')}` : baseDesc;

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'createEventTitle'))
    .setDescription(description);

  const ready = Boolean(
    draft.type && draft.month && draft.day && isValidDayForMonth(draft.day, draft.month)
  );
  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings:create_day_btn')
      .setLabel(t(locale, 'createEventDayBtn'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('settings:create_value_btn')
      .setLabel(t(locale, 'createEventEnterValueBtn'))
      .setStyle(ButtonStyle.Success)
      .setDisabled(!ready),
    new ButtonBuilder()
      .setCustomId('settings:home')
      .setLabel(t(locale, 'back'))
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [...buildTypeAndMonthRows(locale, 'create', draft), btnRow],
  };
}

async function buildManageListPayload(guild: Guild, locale: SupportedLocale, page = 0) {
  const events = await listEvents(guild);
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = events.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'manageSelectTitle'))
    .setDescription(t(locale, 'manageSelectDesc'));

  const components: Array<ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>> = [];

  if (slice.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('settings:manage_select')
      .setPlaceholder(t(locale, 'manageSelectPlaceholder'))
      .addOptions(
        slice.map((ev) => ({
          label: buildEventChannelName(ev.type, ev.day, ev.month),
          description: truncateValue(ev.value, 90),
          value: ev.channel.id,
        }))
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>();
  if (totalPages > 1) {
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`settings:manage_page:${safePage - 1}`)
        .setLabel(t(locale, 'managePrevPage'))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId(`settings:manage_page:${safePage + 1}`)
        .setLabel(t(locale, 'manageNextPage'))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1)
    );
  }
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId('settings:home')
      .setLabel(t(locale, 'back'))
      .setStyle(ButtonStyle.Secondary)
  );
  components.push(navRow);

  return { embeds: [embed], components };
}

function buildEventDetailPayload(
  guild: Guild,
  locale: SupportedLocale,
  channelId: string
) {
  const channel = guild.channels.cache.get(channelId);
  const parsed = channel ? parseEventChannelName(channel.name) : null;
  if (!channel || !parsed || !('topic' in channel)) {
    return null;
  }

  const channelName = buildEventChannelName(parsed.type, parsed.day, parsed.month);
  const value = (channel.topic ?? '').trim() || '—';
  const boostWarning = getBoostRequirementWarning(guild, parsed.type, locale);
  const baseDesc = t(locale, 'manageDetailDesc', {
    channel: `<#${channel.id}>`,
    type: `${parsed.type} (${getEventTypeLabel(locale, parsed.type)})`,
    date: `${parsed.day} ${getMonthName(locale, parsed.month)} (${parsed.day}/${parsed.month})`,
    value,
  });

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'manageDetailTitle', { channelName }))
    .setDescription(boostWarning ? `${baseDesc}\n\n${boostWarning}` : baseDesc);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`settings:event_edit_value_btn:${channel.id}`)
      .setLabel(t(locale, 'manageBtnEditValue'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`settings:event_edit_dt_btn:${channel.id}`)
      .setLabel(t(locale, 'manageBtnEditDateType'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`settings:event_delete_ask:${channel.id}`)
      .setLabel(t(locale, 'manageBtnDelete'))
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('settings:manage_open')
      .setLabel(t(locale, 'back'))
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

function buildEditDateTypePayload(
  guild: Guild,
  locale: SupportedLocale,
  channelId: string,
  oldName: string,
  draft: { type?: EventType; month?: number; day?: number }
) {
  const typeStr = draft.type ? `${draft.type} (${getEventTypeLabel(locale, draft.type)})` : '—';
  const dateStr =
    draft.day && draft.month
      ? `${draft.day} ${getMonthName(locale, draft.month)} (${draft.day}/${draft.month})`
      : '—';
  const newName =
    draft.type && draft.day && draft.month
      ? buildEventChannelName(draft.type, draft.day, draft.month)
      : '—';

  const boostWarning = getBoostRequirementWarning(guild, draft.type, locale);
  const invalidDateWarning =
    draft.day && draft.month && !isValidDayForMonth(draft.day, draft.month)
      ? `⚠️ ${t(locale, 'invalidDayForMonth', {
          day: draft.day,
          month: getMonthName(locale, draft.month),
          maxDay: getMaxDaysInMonth(draft.month),
        })}`
      : null;

  const baseDesc = t(locale, 'editDateTypeDesc', { type: typeStr, date: dateStr, newName });
  const warnings = [boostWarning, invalidDateWarning].filter((w): w is string => Boolean(w));
  const description = warnings.length > 0 ? `${baseDesc}\n\n${warnings.join('\n\n')}` : baseDesc;

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(t(locale, 'editDateTypeTitle', { channelName: oldName }))
    .setDescription(description);

  const ready = Boolean(
    draft.type && draft.month && draft.day && isValidDayForMonth(draft.day, draft.month)
  );
  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`settings:editdt_day_btn:${channelId}`)
      .setLabel(t(locale, 'createEventDayBtn'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`settings:editdt_save:${channelId}`)
      .setLabel(t(locale, 'confirm'))
      .setStyle(ButtonStyle.Success)
      .setDisabled(!ready),
    new ButtonBuilder()
      .setCustomId(`settings:event_detail:${channelId}`)
      .setLabel(t(locale, 'back'))
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [...buildTypeAndMonthRows(locale, 'editdt', draft), btnRow],
  };
}

function buildDayModal(customId: string, locale: SupportedLocale, currentDay?: number) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(t(locale, 'dayModalTitle'));

  const input = new TextInputBuilder()
    .setCustomId('day_input')
    .setLabel(t(locale, 'dayModalLabel'))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('25')
    .setRequired(true)
    .setMaxLength(2);

  if (currentDay !== undefined) {
    input.setValue(String(currentDay));
  }

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  return modal;
}

function buildValueModal(
  customId: string,
  locale: SupportedLocale,
  channelName: string,
  type: EventType,
  initialValue?: string
) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(t(locale, 'eventValueModalTitle', { channelName }));

  const label =
    type === 'n'
      ? t(locale, 'eventValueModalNameLabel')
      : t(locale, 'eventValueModalUrlLabel');

  const input = new TextInputBuilder()
    .setCustomId('event_value_input')
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(type === 'n' ? 'Mon Serveur Festif' : 'https://example.com/image.png')
    .setRequired(true)
    .setMaxLength(type === 'n' ? 100 : 1000);

  if (initialValue) {
    input.setValue(initialValue.slice(0, type === 'n' ? 100 : 1000));
  }

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  return modal;
}

function parseImportEntries(rawText: string): Array<{ name: string; topic: string }> {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsedJson = JSON.parse(trimmed) as unknown;
      const entries: Array<{ name: string; topic: string }> = [];
      if (Array.isArray(parsedJson)) {
        for (const item of parsedJson) {
          if (item && typeof item === 'object' && 'name' in item && 'topic' in item) {
            entries.push({
              name: String((item as { name: unknown }).name).trim(),
              topic: String((item as { topic: unknown }).topic).trim(),
            });
          }
        }
        return entries;
      }
      if (parsedJson && typeof parsedJson === 'object' && 'channels' in parsedJson) {
        const channels = (parsedJson as { channels?: unknown }).channels;
        if (Array.isArray(channels)) {
          for (const item of channels) {
            if (item && typeof item === 'object' && 'name' in item && 'topic' in item) {
              entries.push({
                name: String((item as { name: unknown }).name).trim(),
                topic: String((item as { topic: unknown }).topic).trim(),
              });
            }
          }
          return entries;
        }
      }
    } catch {
      // Fallback to line-based channel:topic parsing
    }
  }

  const results: Array<{ name: string; topic: string }> = [];
  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;
    const name = line.slice(0, colonIdx).trim();
    const topic = line.slice(colonIdx + 1).trim();
    if (name && topic) {
      results.push({ name, topic });
    }
  }
  return results;
}

export async function handleSettingsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const config = await getGuildConfig(interaction.guild);
  const locale = config.logChannel ? config.locale : normalizeLocale(interaction.locale);

  if (!hasGuildAdminPermission(interaction.guild, interaction.user.id, interaction.memberPermissions)) {
    await interaction.reply({
      content: t(locale, 'noPermission'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let botPerms = await checkBotGuildPermissions(interaction.guild, locale);
  if (!botPerms.ok) {
    await Promise.all([
      interaction.guild.members.fetchMe().catch(() => null),
      interaction.guild.roles.fetch().catch(() => null),
      interaction.guild.channels.fetch().catch(() => null),
    ]);
    botPerms = await checkBotGuildPermissions(interaction.guild, locale);
  }

  if (!botPerms.ok) {
    const restoreRole = findRestoreRole(interaction.guild);
    const botHasRole = Boolean(
      restoreRole && interaction.guild.members.me?.roles.cache.has(restoreRole.id)
    );
    const components: Array<ActionRowBuilder<ButtonBuilder>> = [];
    if (restoreRole && !botHasRole && canBotManageRoles(interaction.guild)) {
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('settings:restore_recover')
            .setLabel(t(locale, 'settingsRestoreRecoverBtn'))
            .setStyle(ButtonStyle.Success)
        )
      );
    }
    await interaction.reply({
      embeds: [botPerms.embed],
      components,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  clearSettingsSession(interaction.guild.id, interaction.user.id);
  const payload = await buildMainSettingsPayload(interaction.guild, locale);
  await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}

export async function handleSettingsInteraction(
  interaction: StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction
): Promise<boolean> {
  if (!interaction.customId.startsWith('settings:')) return false;
  if (!interaction.guild) return true;

  const config = await getGuildConfig(interaction.guild);
  const locale = config.logChannel ? config.locale : normalizeLocale(interaction.locale);

  if (!hasGuildAdminPermission(interaction.guild, interaction.user.id, interaction.memberPermissions)) {
    await interaction.reply({
      content: t(locale, 'noPermission'),
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const guild = interaction.guild;
  const userId = interaction.user.id;
  const cid = interaction.customId;

  if (interaction.isButton() && cid === 'settings:restore_recover') {
    await interaction.deferUpdate();
    const result = await enableRestoreRole(guild);
    if (!result.ok) {
      const msgKey =
        result.reason === 'missing_manage_roles'
          ? 'restoreMissingManageRoles'
          : result.reason === 'role_hierarchy'
            ? 'restoreRoleHierarchyError'
            : 'restoreMissingMember';
      await interaction.followUp({
        content: t(locale, msgKey),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const refreshedPerms = await checkBotGuildPermissions(guild, locale);
    if (!refreshedPerms.ok) {
      await interaction.editReply({ embeds: [refreshedPerms.embed], components: [] });
      await interaction.followUp({
        content: t(locale, 'restoreRecoverPartialMsg', {
          role: `<@&${result.role.id}>`,
          count: result.syncedChannels,
        }),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    clearSettingsSession(guild.id, userId);
    await interaction.editReply(await buildMainSettingsPayload(guild, locale));
    await interaction.followUp({
      content: t(locale, 'settingsRestoreEnabledMsg', {
        role: `<@&${result.role.id}>`,
        count: result.syncedChannels,
      }),
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const botPerms = await checkBotGuildPermissions(interaction.guild, locale);
  if (!botPerms.ok) {
    await interaction.reply({
      embeds: [botPerms.embed],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (interaction.isButton()) {
    if (cid === 'settings:home') {
      clearSettingsSession(guild.id, userId);
      await interaction.update(await buildMainSettingsPayload(guild, locale));
      return true;
    }

    if (cid === 'settings:menu_tz') {
      await interaction.update(buildTimezonePayload(locale, config.timezone));
      return true;
    }

    if (cid === 'settings:tz_modal_btn') {
      const modal = new ModalBuilder()
        .setCustomId('settings:tz_modal')
        .setTitle(t(locale, 'setupTzModalTitle'));

      const input = new TextInputBuilder()
        .setCustomId('timezone_input')
        .setLabel(t(locale, 'setupTzModalLabel'))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Europe/Paris / UTC+1')
        .setValue(config.timezone)
        .setRequired(true)
        .setMaxLength(64);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return true;
    }

    if (cid === 'settings:menu_lang') {
      await interaction.update(buildLanguagePayload(locale));
      return true;
    }

    if (cid === 'settings:menu_restore') {
      await interaction.update(await buildRestoreRolePayload(guild, locale));
      return true;
    }

    if (cid === 'settings:restore_enable') {
      await interaction.deferUpdate();
      const result = await enableRestoreRole(guild);
      if (!result.ok) {
        const msgKey =
          result.reason === 'missing_manage_roles'
            ? 'restoreMissingManageRoles'
            : result.reason === 'role_hierarchy'
              ? 'restoreRoleHierarchyError'
              : 'restoreMissingMember';
        await interaction.followUp({
          content: t(locale, msgKey),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      await interaction.editReply(await buildRestoreRolePayload(guild, locale));
      await interaction.followUp({
        content: t(locale, 'settingsRestoreEnabledMsg', {
          role: `<@&${result.role.id}>`,
          count: result.syncedChannels,
        }),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (cid === 'settings:restore_sync') {
      await interaction.deferUpdate();
      const existingRole = findRestoreRole(guild);
      const botHasRole = Boolean(
        existingRole && guild.members.me?.roles.cache.has(existingRole.id)
      );
      if (!existingRole || !botHasRole) {
        const result = await enableRestoreRole(guild);
        if (!result.ok) {
          const msgKey =
            result.reason === 'missing_manage_roles'
              ? 'restoreMissingManageRoles'
              : result.reason === 'role_hierarchy'
                ? 'restoreRoleHierarchyError'
                : 'restoreMissingMember';
          await interaction.followUp({
            content: t(locale, msgKey),
            flags: MessageFlags.Ephemeral,
          });
          return true;
        }
        await interaction.editReply(await buildRestoreRolePayload(guild, locale));
        await interaction.followUp({
          content: t(locale, 'settingsRestoreSyncedMsg', {
            role: `<@&${result.role.id}>`,
            count: result.syncedChannels,
          }),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      const synced = await syncRestoreRoleOverwrites(guild, existingRole);
      await interaction.editReply(await buildRestoreRolePayload(guild, locale));
      await interaction.followUp({
        content: t(locale, 'settingsRestoreSyncedMsg', {
          role: `<@&${existingRole.id}>`,
          count: synced,
        }),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (cid === 'settings:restore_disable') {
      await interaction.deferUpdate();
      const result = await disableRestoreRole(guild);
      if (!result.ok) {
        const msgKey =
          result.reason === 'missing_manage_roles'
            ? 'restoreMissingManageRoles'
            : result.reason === 'role_hierarchy'
              ? 'restoreRoleHierarchyError'
              : 'restoreMissingMember';
        await interaction.followUp({
          content: t(locale, msgKey),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      await interaction.editReply(await buildRestoreRolePayload(guild, locale));
      await interaction.followUp({
        content: t(locale, 'settingsRestoreDisabledMsg'),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (cid === 'settings:export') {
      const events = await listEvents(guild);
      const createdAtIso = new Date().toISOString();
      const lines: string[] = [
        '# Logoto Export',
        `# Created-At: ${createdAtIso}`,
        `# Guild: ${guild.name} (${guild.id})`,
        '# Format: nom_du_salon:sujet_du_salon',
      ];

      let exportedCount = 0;

      if (config.logChannel) {
        const logCreatedAt = config.logChannel.createdAt.toISOString();
        const topic = formatConfigTopic(config.timezone, config.locale, {
          restoreRole: config.restoreRoleEnabled,
        });
        lines.push(`# Channel ${config.logChannel.name} | Created-At: ${logCreatedAt}`);
        lines.push(`${config.logChannel.name}:${topic}`);
        exportedCount += 1;
      }

      for (const ev of events) {
        const chName = buildEventChannelName(ev.type, ev.day, ev.month);
        const chCreatedAt = ev.channel.createdAt.toISOString();
        lines.push(`# Channel ${chName} | Created-At: ${chCreatedAt}`);
        lines.push(`${chName}:${ev.value}`);
        exportedCount += 1;
      }

      const contentBuffer = Buffer.from(lines.join('\n') + '\n', 'utf-8');
      const fileDate = createdAtIso.slice(0, 10);
      const attachment = new AttachmentBuilder(contentBuffer, {
        name: `logoto-export-${fileDate}.txt`,
      });

      const embed = new EmbedBuilder()
        .setColor(PRIMARY_COLOR)
        .setTitle(t(locale, 'exportTitle'))
        .setDescription(
          t(locale, 'exportDesc', {
            count: exportedCount,
            createdAt: createdAtIso,
          })
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        files: [attachment],
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (cid === 'settings:import') {
      const channel = interaction.channel;
      if (!channel || !('createMessageCollector' in channel)) {
        await interaction.reply({
          content: t(locale, 'importNoChannel'),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      const key = importKey(guild.id, userId);
      const prevCollector = activeImportCollectors.get(key);
      if (prevCollector && !prevCollector.ended) {
        prevCollector.stop('replaced');
      }

      const embed = new EmbedBuilder()
        .setColor(PRIMARY_COLOR)
        .setTitle(t(locale, 'importPromptTitle'))
        .setDescription(t(locale, 'importPromptDesc'));

      const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('settings:import_cancel')
          .setLabel(t(locale, 'cancel'))
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        embeds: [embed],
        components: [cancelRow],
        flags: MessageFlags.Ephemeral,
      });

      const collector = channel.createMessageCollector({
        filter: (m) => m.author.id === userId && m.attachments.size > 0,
        max: 1,
        time: 120_000,
      });

      activeImportCollectors.set(key, collector);

      collector.on('collect', async (msg) => {
        activeImportCollectors.delete(key);
        const attachment = msg.attachments.first();
        await msg.delete().catch(() => {});

        if (!attachment || attachment.size > MAX_IMPORT_BYTES) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle(t(locale, 'importPromptTitle'))
                .setDescription(t(locale, 'importInvalidFile')),
            ],
            components: [],
          }).catch(() => {});
          return;
        }

        try {
          const parsedUrl = new URL(attachment.url);
          if (
            parsedUrl.protocol !== 'https:' ||
            !ALLOWED_DISCORD_CDN_HOSTS.has(parsedUrl.hostname.toLowerCase())
          ) {
            throw new Error('Untrusted attachment URL');
          }

          const resp = await fetch(parsedUrl.toString());
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }

          const rawText = await resp.text();
          const entries = parseImportEntries(rawText);

          if (entries.length === 0) {
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xed4245)
                  .setTitle(t(locale, 'importPromptTitle'))
                  .setDescription(t(locale, 'importInvalidFile')),
              ],
              components: [],
            }).catch(() => {});
            return;
          }

          let created = 0;
          let updated = 0;
          let configUpdated = 0;
          let skipped = 0;

          for (const entry of entries) {
            if (entry.name.toLowerCase() === 'log-logoto') {
              const parsedCfg = parseConfigFromTopic(entry.topic);
              await setGuildConfig(guild, {
                timezone: parsedCfg.timezone,
                locale: parsedCfg.locale,
                restoreRole: parsedCfg.restoreRole,
              });
              if (parsedCfg.restoreRole) {
                await enableRestoreRole(guild).catch(() => {});
              }
              configUpdated += 1;
              continue;
            }

            const parsedEv = parseEventChannelName(entry.name);
            if (!parsedEv) {
              skipped += 1;
              continue;
            }

            if (parsedEv.type === 'n') {
              if (!isValidServerName(entry.topic)) {
                skipped += 1;
                continue;
              }
            } else if (!isSafeImageUrl(entry.topic)) {
              skipped += 1;
              continue;
            }

            const result = await upsertEvent(guild, {
              type: parsedEv.type,
              day: parsedEv.day,
              month: parsedEv.month,
              value: entry.topic,
            });
            if (result.created) {
              created += 1;
            } else {
              updated += 1;
            }
          }

          const resultEmbed = new EmbedBuilder()
            .setColor(PRIMARY_COLOR)
            .setTitle(t(locale, 'importResultTitle'))
            .setDescription(
              t(locale, 'importResultDesc', {
                created,
                updated,
                configUpdated,
                skipped,
              })
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [resultEmbed], components: [] }).catch(() => {});
        } catch (err) {
          console.error('[Logoto] Import failed:', err);
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle(t(locale, 'importPromptTitle'))
                .setDescription(t(locale, 'importInvalidFile')),
            ],
            components: [],
          }).catch(() => {});
        }
      });

      collector.on('end', (_collected, reason) => {
        activeImportCollectors.delete(key);
        if (reason === 'time') {
          void interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(PRIMARY_COLOR)
                .setTitle(t(locale, 'importPromptTitle'))
                .setDescription(t(locale, 'importTimeout')),
            ],
            components: [],
          }).catch(() => {});
        }
      });

      return true;
    }

    if (cid === 'settings:import_cancel') {
      const key = importKey(guild.id, userId);
      const collector = activeImportCollectors.get(key);
      if (collector && !collector.ended) {
        collector.stop('cancelled');
      }
      activeImportCollectors.delete(key);
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(PRIMARY_COLOR)
            .setTitle(t(locale, 'importPromptTitle'))
            .setDescription(t(locale, 'importCancelled')),
        ],
        components: [],
      });
      return true;
    }

    if (cid === 'settings:create_open') {
      const draft = setSettingsSession(guild.id, userId, { mode: 'create' });
      await interaction.update(buildCreateEventPayload(guild, locale, draft));
      return true;
    }

    if (cid === 'settings:create_day_btn') {
      const draft = getSettingsSession(guild.id, userId);
      await interaction.showModal(buildDayModal('settings:create_day_modal', locale, draft?.day));
      return true;
    }

    if (cid === 'settings:create_value_btn') {
      const draft = getSettingsSession(guild.id, userId);
      if (!draft || draft.mode !== 'create' || !draft.type || !draft.month || !draft.day) {
        await interaction.reply({
          content: t(locale, 'createEventMissingFields'),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }
      if (!isValidDayForMonth(draft.day, draft.month)) {
        await interaction.reply({
          content: t(locale, 'invalidDayForMonth', {
            day: draft.day,
            month: getMonthName(locale, draft.month),
            maxDay: getMaxDaysInMonth(draft.month),
          }),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      const channelName = buildEventChannelName(draft.type, draft.day, draft.month);
      await interaction.showModal(
        buildValueModal('settings:create_value_modal', locale, channelName, draft.type)
      );
      return true;
    }

    if (cid === 'settings:manage_open') {
      await interaction.update(await buildManageListPayload(guild, locale, 0));
      return true;
    }

    if (cid.startsWith('settings:manage_page:')) {
      const page = Number(cid.split(':')[2] ?? '0');
      await interaction.update(await buildManageListPayload(guild, locale, Number.isFinite(page) ? page : 0));
      return true;
    }

    if (cid.startsWith('settings:event_detail:')) {
      const channelId = cid.split(':')[2];
      const detail = buildEventDetailPayload(guild, locale, channelId);
      if (!detail) {
        await interaction.update(await buildMainSettingsPayload(guild, locale));
        return true;
      }
      await interaction.update(detail);
      return true;
    }

    if (cid.startsWith('settings:event_edit_value_btn:')) {
      const channelId = cid.split(':')[2];
      const ch = guild.channels.cache.get(channelId);
      const parsed = ch ? parseEventChannelName(ch.name) : null;
      if (!ch || !parsed || !('topic' in ch)) {
        await interaction.reply({ content: t(locale, 'sessionExpired'), flags: MessageFlags.Ephemeral });
        return true;
      }
      const chName = buildEventChannelName(parsed.type, parsed.day, parsed.month);
      await interaction.showModal(
        buildValueModal(
          `settings:event_edit_value_modal:${channelId}`,
          locale,
          chName,
          parsed.type,
          ch.topic ?? ''
        )
      );
      return true;
    }

    if (cid.startsWith('settings:event_edit_dt_btn:')) {
      const channelId = cid.split(':')[2];
      const ch = guild.channels.cache.get(channelId);
      const parsed = ch ? parseEventChannelName(ch.name) : null;
      if (!ch || !parsed) {
        await interaction.update(await buildMainSettingsPayload(guild, locale));
        return true;
      }

      const draft = setSettingsSession(guild.id, userId, {
        mode: 'editDateType',
        targetChannelId: channelId,
        type: parsed.type,
        month: parsed.month,
        day: parsed.day,
      });

      const oldName = buildEventChannelName(parsed.type, parsed.day, parsed.month);
      await interaction.update(buildEditDateTypePayload(guild, locale, channelId, oldName, draft));
      return true;
    }

    if (cid.startsWith('settings:editdt_day_btn:')) {
      const channelId = cid.split(':')[2];
      const ch = guild.channels.cache.get(channelId);
      const parsed = ch ? parseEventChannelName(ch.name) : null;
      const existing = getSettingsSession(guild.id, userId);

      const currentDay = existing?.day ?? parsed?.day;
      if (!existing && parsed) {
        setSettingsSession(guild.id, userId, {
          mode: 'editDateType',
          targetChannelId: channelId,
          type: parsed.type,
          month: parsed.month,
          day: parsed.day,
        });
      }

      await interaction.showModal(
        buildDayModal(`settings:editdt_day_modal:${channelId}`, locale, currentDay)
      );
      return true;
    }

    if (cid.startsWith('settings:editdt_save:')) {
      const channelId = cid.split(':')[2];
      const draft = getSettingsSession(guild.id, userId);
      if (!draft || draft.mode !== 'editDateType' || !draft.type || !draft.month || !draft.day) {
        await interaction.reply({ content: t(locale, 'sessionExpired'), flags: MessageFlags.Ephemeral });
        return true;
      }
      if (!isValidDayForMonth(draft.day, draft.month)) {
        await interaction.reply({
          content: t(locale, 'invalidDayForMonth', {
            day: draft.day,
            month: getMonthName(locale, draft.month),
            maxDay: getMaxDaysInMonth(draft.month),
          }),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      const newName = buildEventChannelName(draft.type, draft.day, draft.month);
      await interaction.deferUpdate();
      const result = await updateEventChannel(guild, channelId, {
        type: draft.type,
        day: draft.day,
        month: draft.month,
      });

      if (!result) {
        await interaction.editReply(await buildMainSettingsPayload(guild, locale));
        return true;
      }

      if (result.conflict) {
        await interaction.followUp({
          content: t(locale, 'editDateTypeConflict', { newName }),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      clearSettingsSession(guild.id, userId);
      const detail = buildEventDetailPayload(guild, locale, channelId);
      if (detail) {
        await interaction.editReply(detail);
      } else {
        await interaction.editReply(await buildMainSettingsPayload(guild, locale));
      }
      return true;
    }

    if (cid.startsWith('settings:event_delete_ask:')) {
      const channelId = cid.split(':')[2];
      const ch = guild.channels.cache.get(channelId);
      if (!ch) {
        await interaction.update(await buildMainSettingsPayload(guild, locale));
        return true;
      }

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(t(locale, 'deleteConfirmTitle'))
        .setDescription(t(locale, 'deleteConfirmDesc', { channelName: ch.name, channel: `<#${ch.id}>` }));

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`settings:event_delete_confirm:${channelId}`)
          .setLabel(t(locale, 'confirm'))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`settings:event_detail:${channelId}`)
          .setLabel(t(locale, 'cancel'))
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({ embeds: [embed], components: [row] });
      return true;
    }

    if (cid.startsWith('settings:event_delete_confirm:')) {
      const channelId = cid.split(':')[2];
      const ch = guild.channels.cache.get(channelId);
      const oldName = ch?.name ?? channelId;

      await interaction.deferUpdate();
      await deleteEvent(guild, channelId);

      const embed = new EmbedBuilder()
        .setColor(PRIMARY_COLOR)
        .setTitle(t(locale, 'deleteDoneTitle'))
        .setDescription(t(locale, 'deleteDoneDesc', { channelName: oldName }));

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('settings:home')
          .setLabel(t(locale, 'back'))
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return true;
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (cid === 'settings:tz_select') {
      const tz = interaction.values[0];
      if (!isValidTimeZone(tz)) {
        await interaction.reply({ content: t(locale, 'invalidTimezone', { tz }), flags: MessageFlags.Ephemeral });
        return true;
      }
      await interaction.deferUpdate();
      await setGuildConfig(guild, { timezone: tz });
      await interaction.editReply(await buildMainSettingsPayload(guild, locale));
      return true;
    }

    if (cid === 'settings:lang_select') {
      const nextLocale = normalizeLocale(interaction.values[0]);
      await interaction.deferUpdate();
      await setGuildConfig(guild, { locale: nextLocale });
      await interaction.editReply(await buildMainSettingsPayload(guild, nextLocale));
      return true;
    }

    if (cid === 'settings:create_type' || cid === 'settings:create_month') {
      const current = getSettingsSession(guild.id, userId) ?? { mode: 'create' as const, updatedAt: Date.now() };
      const val = interaction.values[0];

      const next = setSettingsSession(guild.id, userId, {
        mode: 'create',
        type: cid === 'settings:create_type' ? (val as EventType) : current.type,
        month: cid === 'settings:create_month' ? Number(val) : current.month,
        day: current.day,
      });

      await interaction.update(buildCreateEventPayload(guild, locale, next));
      return true;
    }

    if (cid === 'settings:editdt_type' || cid === 'settings:editdt_month') {
      const current = getSettingsSession(guild.id, userId);
      if (!current || current.mode !== 'editDateType' || !current.targetChannelId) {
        await interaction.reply({ content: t(locale, 'sessionExpired'), flags: MessageFlags.Ephemeral });
        return true;
      }

      const val = interaction.values[0];
      const next = setSettingsSession(guild.id, userId, {
        mode: 'editDateType',
        targetChannelId: current.targetChannelId,
        type: cid === 'settings:editdt_type' ? (val as EventType) : current.type,
        month: cid === 'settings:editdt_month' ? Number(val) : current.month,
        day: current.day,
      });

      const ch = guild.channels.cache.get(current.targetChannelId);
      await interaction.update(
        buildEditDateTypePayload(guild, locale, current.targetChannelId, ch?.name ?? 'event', next)
      );
      return true;
    }

    if (cid === 'settings:manage_select') {
      const channelId = interaction.values[0];
      const detail = buildEventDetailPayload(guild, locale, channelId);
      if (!detail) {
        await interaction.update(await buildMainSettingsPayload(guild, locale));
        return true;
      }
      await interaction.update(detail);
      return true;
    }
  }

  if (interaction.isModalSubmit()) {
    if (cid === 'settings:tz_modal') {
      const rawTz = interaction.fields.getTextInputValue('timezone_input').trim();
      if (!isValidTimeZone(rawTz)) {
        await interaction.reply({
          content: t(locale, 'invalidTimezone', { tz: rawTz }),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      await interaction.deferUpdate();
      await setGuildConfig(guild, { timezone: rawTz });
      await interaction.editReply(await buildMainSettingsPayload(guild, locale));
      return true;
    }

    if (cid === 'settings:create_day_modal') {
      const rawDay = interaction.fields.getTextInputValue('day_input').trim();
      const parsedDay = parseValidDay(rawDay);
      if (parsedDay === null) {
        await interaction.reply({
          content: t(locale, 'invalidDay', { day: rawDay }),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      const current = getSettingsSession(guild.id, userId);
      if (current?.month && !isValidDayForMonth(parsedDay, current.month)) {
        await interaction.reply({
          content: t(locale, 'invalidDayForMonth', {
            day: parsedDay,
            month: getMonthName(locale, current.month),
            maxDay: getMaxDaysInMonth(current.month),
          }),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      const next = setSettingsSession(guild.id, userId, {
        mode: 'create',
        type: current?.type,
        month: current?.month,
        day: parsedDay,
      });

      await interaction.deferUpdate();
      await interaction.editReply(buildCreateEventPayload(guild, locale, next));
      return true;
    }

    if (cid.startsWith('settings:editdt_day_modal:')) {
      const channelId = cid.split(':')[2];
      const rawDay = interaction.fields.getTextInputValue('day_input').trim();
      const parsedDay = parseValidDay(rawDay);
      if (parsedDay === null) {
        await interaction.reply({
          content: t(locale, 'invalidDay', { day: rawDay }),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      const ch = guild.channels.cache.get(channelId);
      const parsedChannel = ch ? parseEventChannelName(ch.name) : null;
      const current = getSettingsSession(guild.id, userId);
      const targetMonth = current?.month ?? parsedChannel?.month;

      if (targetMonth && !isValidDayForMonth(parsedDay, targetMonth)) {
        await interaction.reply({
          content: t(locale, 'invalidDayForMonth', {
            day: parsedDay,
            month: getMonthName(locale, targetMonth),
            maxDay: getMaxDaysInMonth(targetMonth),
          }),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      const next = setSettingsSession(guild.id, userId, {
        mode: 'editDateType',
        targetChannelId: channelId,
        type: current?.type ?? parsedChannel?.type,
        month: targetMonth,
        day: parsedDay,
      });

      await interaction.deferUpdate();
      await interaction.editReply(
        buildEditDateTypePayload(guild, locale, channelId, ch?.name ?? 'event', next)
      );
      return true;
    }

    if (cid === 'settings:create_value_modal') {
      const draft = getSettingsSession(guild.id, userId);
      if (
        !draft ||
        draft.mode !== 'create' ||
        !draft.type ||
        !draft.month ||
        !draft.day ||
        !isValidDayForMonth(draft.day, draft.month)
      ) {
        await interaction.reply({ content: t(locale, 'sessionExpired'), flags: MessageFlags.Ephemeral });
        return true;
      }

      const value = interaction.fields.getTextInputValue('event_value_input').trim();
      if (draft.type === 'n') {
        if (!isValidServerName(value)) {
          await interaction.reply({ content: t(locale, 'invalidServerName'), flags: MessageFlags.Ephemeral });
          return true;
        }
      } else if (!isSafeImageUrl(value)) {
        await interaction.reply({ content: t(locale, 'invalidImageUrl'), flags: MessageFlags.Ephemeral });
        return true;
      }

      await interaction.deferUpdate();
      const { channel, created } = await upsertEvent(guild, {
        type: draft.type,
        day: draft.day,
        month: draft.month,
        value,
      });

      const channelName = buildEventChannelName(draft.type, draft.day, draft.month);
      clearSettingsSession(guild.id, userId);

      const embed = new EmbedBuilder()
        .setColor(PRIMARY_COLOR)
        .setTitle(t(locale, 'eventSavedTitle'))
        .setDescription(
          t(locale, created ? 'eventSavedCreated' : 'eventSavedUpdated', {
            channel: `<#${channel.id}>`,
            channelName,
            value,
          })
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('settings:home')
          .setLabel(t(locale, 'back'))
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return true;
    }

    if (cid.startsWith('settings:event_edit_value_modal:')) {
      const channelId = cid.split(':')[2];
      const ch = guild.channels.cache.get(channelId);
      const parsed = ch ? parseEventChannelName(ch.name) : null;
      if (!ch || !parsed) {
        await interaction.reply({ content: t(locale, 'sessionExpired'), flags: MessageFlags.Ephemeral });
        return true;
      }

      const value = interaction.fields.getTextInputValue('event_value_input').trim();
      if (parsed.type === 'n') {
        if (!isValidServerName(value)) {
          await interaction.reply({ content: t(locale, 'invalidServerName'), flags: MessageFlags.Ephemeral });
          return true;
        }
      } else if (!isSafeImageUrl(value)) {
        await interaction.reply({ content: t(locale, 'invalidImageUrl'), flags: MessageFlags.Ephemeral });
        return true;
      }

      await interaction.deferUpdate();
      await updateEventChannel(guild, channelId, { value });
      const detail = buildEventDetailPayload(guild, locale, channelId);
      if (detail) {
        await interaction.editReply(detail);
      } else {
        await interaction.editReply(await buildMainSettingsPayload(guild, locale));
      }
      return true;
    }
  }

  return false;
}
