import {
  ActionRowBuilder,
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
import { getGuildConfig, isValidTimeZone, setGuildConfig } from '../services/guildConfigService.js';
import type { EventType, SupportedLocale } from '../types.js';
import {
  formatLocalDateTimeDisplay,
  hasGuildAdminPermission,
  isSafeImageUrl,
  isValidServerName,
  truncateValue,
} from '../utils/validators.js';

const EVENT_TYPES: readonly EventType[] = ['l', 'n', 'b', 'i'];
const PAGE_SIZE = 25;

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

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t(locale, 'settingsTitle', { guild: guild.name }))
    .setDescription(`${t(locale, 'settingsDesc', { tz: config.timezone, lang: locale, localTime })}${warningNote}`)
    .addFields({
      name: t(locale, 'settingsEventsField', { count: events.length }),
      value: lines.length > 0 ? lines.join('\n') : t(locale, 'settingsNoEvents'),
    })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

  return { embeds: [embed], components: [row] };
}

function buildTimezonePayload(locale: SupportedLocale, currentTz: string) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t(locale, 'settingsTzTitle'))
    .setDescription(t(locale, 'settingsTzDesc', { tz: currentTz }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('settings:tz_select')
    .setPlaceholder(t(locale, 'setupTzPlaceholder'))
    .addOptions(
      COMMON_TIMEZONES.map((tz) => ({
        label: tz,
        value: tz,
        default: tz === currentTz,
      }))
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
    .setColor(0x5865f2)
    .setTitle(t(locale, 'settingsLangTitle'))
    .setDescription(t(locale, 'settingsLangDesc', { lang: locale }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('settings:lang_select')
    .setPlaceholder(t(locale, 'setupLangPlaceholder'))
    .addOptions(
      { label: 'Français (fr)', value: 'fr', emoji: '🇫🇷', default: locale === 'fr' },
      { label: 'English (en)', value: 'en', emoji: '🇬🇧', default: locale === 'en' }
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

function buildDateTypeSelectorRows(
  locale: SupportedLocale,
  prefix: 'create' | 'editdt',
  selected: { type?: EventType; month?: number; day?: number }
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

  const dayLowMenu = new StringSelectMenuBuilder()
    .setCustomId(`settings:${prefix}_day_low`)
    .setPlaceholder(t(locale, 'createEventSelectDayLow'))
    .addOptions(
      Array.from({ length: 16 }, (_, idx) => {
        const d = idx + 1;
        return {
          label: String(d),
          value: String(d),
          default: selected.day === d,
        };
      })
    );

  const dayHighMenu = new StringSelectMenuBuilder()
    .setCustomId(`settings:${prefix}_day_high`)
    .setPlaceholder(t(locale, 'createEventSelectDayHigh'))
    .addOptions(
      Array.from({ length: 15 }, (_, idx) => {
        const d = idx + 17;
        return {
          label: String(d),
          value: String(d),
          default: selected.day === d,
        };
      })
    );

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(monthMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(dayLowMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(dayHighMenu),
  ];
}

function buildCreateEventPayload(
  locale: SupportedLocale,
  draft: { type?: EventType; month?: number; day?: number }
) {
  const typeStr = draft.type ? `${draft.type} (${getEventTypeLabel(locale, draft.type)})` : '—';
  const dateStr =
    draft.day && draft.month ? `${draft.day} ${getMonthName(locale, draft.month)} (${draft.day}/${draft.month})` : '—';
  const chName =
    draft.type && draft.day && draft.month
      ? buildEventChannelName(draft.type, draft.day, draft.month)
      : '—';

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(t(locale, 'createEventTitle'))
    .setDescription(t(locale, 'createEventDesc', { type: typeStr, date: dateStr, channelName: chName }));

  const ready = Boolean(draft.type && draft.month && draft.day);
  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
    components: [...buildDateTypeSelectorRows(locale, 'create', draft), btnRow],
  };
}

async function buildManageListPayload(guild: Guild, locale: SupportedLocale, page = 0) {
  const events = await listEvents(guild);
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = events.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
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

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(t(locale, 'manageDetailTitle', { channelName }))
    .setDescription(
      t(locale, 'manageDetailDesc', {
        channel: `<#${channel.id}>`,
        type: `${parsed.type} (${getEventTypeLabel(locale, parsed.type)})`,
        date: `${parsed.day} ${getMonthName(locale, parsed.month)} (${parsed.day}/${parsed.month})`,
        value,
      })
    );

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
  locale: SupportedLocale,
  channelId: string,
  oldName: string,
  draft: { type?: EventType; month?: number; day?: number }
) {
  const typeStr = draft.type ? `${draft.type} (${getEventTypeLabel(locale, draft.type)})` : '—';
  const dateStr =
    draft.day && draft.month ? `${draft.day} ${getMonthName(locale, draft.month)} (${draft.day}/${draft.month})` : '—';
  const newName =
    draft.type && draft.day && draft.month
      ? buildEventChannelName(draft.type, draft.day, draft.month)
      : '—';

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(t(locale, 'editDateTypeTitle', { channelName: oldName }))
    .setDescription(t(locale, 'editDateTypeDesc', { type: typeStr, date: dateStr, newName }));

  const ready = Boolean(draft.type && draft.month && draft.day);
  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
    components: [...buildDateTypeSelectorRows(locale, 'editdt', draft), btnRow],
  };
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
        .setPlaceholder('Europe/Paris')
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

    if (cid === 'settings:create_open') {
      const draft = setSettingsSession(guild.id, userId, { mode: 'create' });
      await interaction.update(buildCreateEventPayload(locale, draft));
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
      await interaction.update(buildEditDateTypePayload(locale, channelId, oldName, draft));
      return true;
    }

    if (cid.startsWith('settings:editdt_save:')) {
      const channelId = cid.split(':')[2];
      const draft = getSettingsSession(guild.id, userId);
      if (!draft || draft.mode !== 'editDateType' || !draft.type || !draft.month || !draft.day) {
        await interaction.reply({ content: t(locale, 'sessionExpired'), flags: MessageFlags.Ephemeral });
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
        .setColor(0x57f287)
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

    if (
      cid === 'settings:create_type' ||
      cid === 'settings:create_month' ||
      cid === 'settings:create_day_low' ||
      cid === 'settings:create_day_high'
    ) {
      const current = getSettingsSession(guild.id, userId) ?? { mode: 'create' as const, updatedAt: Date.now() };
      const val = interaction.values[0];

      const next = setSettingsSession(guild.id, userId, {
        mode: 'create',
        type: cid === 'settings:create_type' ? (val as EventType) : current.type,
        month: cid === 'settings:create_month' ? Number(val) : current.month,
        day:
          cid === 'settings:create_day_low' || cid === 'settings:create_day_high'
            ? Number(val)
            : current.day,
      });

      await interaction.update(buildCreateEventPayload(locale, next));
      return true;
    }

    if (
      cid === 'settings:editdt_type' ||
      cid === 'settings:editdt_month' ||
      cid === 'settings:editdt_day_low' ||
      cid === 'settings:editdt_day_high'
    ) {
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
        day:
          cid === 'settings:editdt_day_low' || cid === 'settings:editdt_day_high'
            ? Number(val)
            : current.day,
      });

      const ch = guild.channels.cache.get(current.targetChannelId);
      await interaction.update(
        buildEditDateTypePayload(locale, current.targetChannelId, ch?.name ?? 'event', next)
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

    if (cid === 'settings:create_value_modal') {
      const draft = getSettingsSession(guild.id, userId);
      if (!draft || draft.mode !== 'create' || !draft.type || !draft.month || !draft.day) {
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
        .setColor(0x57f287)
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
