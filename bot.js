/**
 * ==============================================================================
 * DISCORD QUEUE BOT - GESTOR DE COLAS Y TURNOS INDEPENDIENTES
 * ==============================================================================
 * Funcionalidades:
 * - Colas múltiples e independientes por canal.
 * - Botones interactivos limpios: [Unirse], [Salir], [Siguiente], [Atrás].
 * - Comando /cola reset: Limpia los turnos del día, vacía las colas y las pausa/cierra.
 * - Comando /cola abrir: Abre y reanuda todas las colas activas.
 * - Comando /cola cerrar: Cierra/pausa una o todas las colas.
 * - Comando /cola eliminar: Elimina permanentemente una cola y su mensaje.
 * - Comando /cola insertar: Inserta un usuario en una posición específica (desplaza a los demás).
 * - Apertura automática programada: Diariamente a las 18:00 (Hora Chile / America/Santiago).
 * - Timestamps universales de Discord (<t:TIMESTAMP:t>) para horarios relativos al país de cada usuario.
 * - Identificación robusta de Apodos de Servidor (member.nickname / displayName).
 * ==============================================================================
 */

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'queues.json');
const LEGACY_DATA_FILE = path.join(__dirname, 'queues_data.json');

// Memoria de colas activas (ID de la cola -> Datos)
const queues = new Map();

// Cargar colas guardadas del disco
function loadQueues() {
  try {
    const fileToLoad = fs.existsSync(DATA_FILE) 
      ? DATA_FILE 
      : (fs.existsSync(LEGACY_DATA_FILE) ? LEGACY_DATA_FILE : null);

    if (fileToLoad) {
      const data = JSON.parse(fs.readFileSync(fileToLoad, 'utf8'));
      for (const [k, v] of Object.entries(data)) {
        queues.set(k, v);
      }
      console.log(`📂 [DATA] Se cargaron ${queues.size} colas desde ${path.basename(fileToLoad)}.`);
      
      // Si leyó el antiguo, lo migramos al nuevo automáticamente
      if (fileToLoad === LEGACY_DATA_FILE && !fs.existsSync(DATA_FILE)) {
        saveQueues();
      }
    }
  } catch (err) {
    console.error('❌ Error leyendo archivo de colas:', err);
  }
}

// Guardar colas al disco
function saveQueues() {
  try {
    const obj = {};
    for (const [k, v] of queues.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Error guardando queues.json:', err);
  }
}

// Helper para resolver canales de forma instantánea usando caché primero
async function resolveChannel(channelId, fallbackChannel) {
  if (!channelId) return fallbackChannel || null;
  if (fallbackChannel && fallbackChannel.id === channelId) return fallbackChannel;
  try {
    if (client && client.channels) {
      const cached = client.channels.cache.get(channelId);
      if (cached) return cached;
      return await client.channels.fetch(channelId).catch(() => null);
    }
  } catch {}
  return fallbackChannel || null;
}

// Helper para auto-eliminar respuestas de comandos en el chat tras un tiempo y mantener el canal limpio
function autoDeleteReply(interaction, delaySeconds = 10) {
  if (!interaction) return;
  setTimeout(async () => {
    try {
      if (typeof interaction.deleteReply === 'function') {
        await interaction.deleteReply().catch(() => {});
      }
    } catch (_) {}
  }, delaySeconds * 1000);
}

// Helper para limpiar mensajes ajenos de un canal donde hay colas activas (protegiendo los paneles)
async function cleanChannelExtraneousMessages(channel, limit = 50) {
  if (!channel || !channel.guild) return 0;
  try {
    const permissions = channel.permissionsFor(channel.client.user);
    if (!permissions || !permissions.has(PermissionFlagsBits.ManageMessages)) {
      return 0;
    }

    // Identificar todos los messageId de colas registradas para NUNCA borrarlos
    const channelQueues = getQueuesInChannel(channel.id);
    const protectedMessageIds = new Set(channelQueues.map(q => q.messageId).filter(Boolean));

    const messages = await channel.messages.fetch({ limit: Math.min(limit, 100) }).catch(() => null);
    if (!messages || messages.size === 0) return 0;

    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000 - 60000);
    const toDeleteBulk = [];
    const toDeleteIndividual = [];

    messages.forEach(msg => {
      // No borrar mensajes del panel de colas ni mensajes fijados/anclados
      if (protectedMessageIds.has(msg.id) || msg.pinned) return;

      if (msg.createdTimestamp > twoWeeksAgo) {
        toDeleteBulk.push(msg);
      } else {
        toDeleteIndividual.push(msg);
      }
    });

    let deletedCount = 0;
    if (toDeleteBulk.length > 0) {
      const deleted = await channel.bulkDelete(toDeleteBulk, true).catch(() => null);
      if (deleted) deletedCount += deleted.size;
    }

    for (const msg of toDeleteIndividual) {
      await msg.delete().catch(() => {});
      deletedCount++;
    }

    return deletedCount;
  } catch (err) {
    console.error('Error al limpiar mensajes del canal:', err);
    return 0;
  }
}

// Helper para obtener el nombre o apodo más preciso de un usuario
async function getMemberDisplayName(guild, user, interactionMember = null) {
  if (interactionMember && interactionMember.id === user.id) {
    if (interactionMember.nickname) return interactionMember.nickname;
    if (interactionMember.displayName) return interactionMember.displayName;
  }
  if (guild) {
    try {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (member) {
        return member.nickname || member.displayName || user.globalName || user.username;
      }
    } catch {}
  }
  return user.globalName || user.displayName || user.username;
}

// Obtener todas las colas de un canal ordenadas
function getQueuesInChannel(channelId) {
  const list = [];
  for (const q of queues.values()) {
    if (q.channelId === channelId) list.push(q);
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Helper para verificar permisos de administración de la cola
function canManageQueue(queueData, interaction) {
  if (!queueData) return false;
  if (queueData.hostId === interaction.user.id) return true;

  const perms = interaction.memberPermissions || interaction.member?.permissions;
  if (perms) {
    if (perms.has(PermissionFlagsBits.Administrator)) return true;
    if (perms.has(PermissionFlagsBits.ManageGuild)) return true;
    if (perms.has(PermissionFlagsBits.ManageMessages)) return true;
    if (perms.has(PermissionFlagsBits.ManageChannels)) return true;
  }
  return false;
}

// Helper para saber si actualmente es horario habilitado o si la cola está abierta
function getChileCurrentHour() {
  try {
    const formatter = new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find(p => p.type === 'hour');
    return parseInt(hourPart.value, 10);
  } catch {
    // Fallback a hora local
    return new Date().getHours();
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

// Comandos Slash
const slashCommands = [
  new SlashCommandBuilder()
    .setName('cola')
    .setDescription('Gestiona colas de turnos y listas de espera')
    .addSubcommand(sub =>
      sub
        .setName('crear')
        .setDescription('Crea una nueva cola independiente')
        .addStringOption(opt =>
          opt.setName('titulo')
            .setDescription('Nombre o tema de la cola')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('nivel')
            .setDescription('Nivel de poción/mazmorra (20, 40, 60, ..., 200)')
            .setRequired(false)
            .addChoices(
              { name: '🧪 Nivel 20', value: 20 },
              { name: '🧪 Nivel 40', value: 40 },
              { name: '🧪 Nivel 60', value: 60 },
              { name: '🧪 Nivel 80', value: 80 },
              { name: '🧪 Nivel 100', value: 100 },
              { name: '🧪 Nivel 120', value: 120 },
              { name: '🧪 Nivel 140', value: 140 },
              { name: '🧪 Nivel 160', value: 160 },
              { name: '🧪 Nivel 180', value: 180 },
              { name: '🧪 Nivel 200', value: 200 }
            )
        )
        .addStringOption(opt =>
          opt.setName('descripcion')
            .setDescription('Detalles o instrucciones adicionales')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('limite')
            .setDescription('Límite de personas (0 para sin límite)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('por_turno')
            .setDescription('Cupos simultáneos por turno (por defecto 1)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('icono')
            .setDescription('URL directa de la imagen/miniatura (ej: https://...png)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('banner')
            .setDescription('URL directa del banner inferior (ej: https://...png)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('mostrar')
        .setDescription('Publica/reinvoca el mensaje interactivo público de una cola en el chat')
        .addStringOption(opt =>
          opt.setName('cola')
            .setDescription('Cola a mostrar en el canal')
            .setAutocomplete(true)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('editar')
        .setDescription('Modifica el nombre, nivel, descripción, icono, banner o límite de una cola')
        .addStringOption(opt =>
          opt.setName('cola')
            .setDescription('Cola que deseas editar')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('titulo')
            .setDescription('Nuevo nombre o tema de la cola')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('nivel')
            .setDescription('Nuevo nivel de poción/mazmorra (20 a 200, o 0 para quitar)')
            .setRequired(false)
            .addChoices(
              { name: '🧪 Nivel 20', value: 20 },
              { name: '🧪 Nivel 40', value: 40 },
              { name: '🧪 Nivel 60', value: 60 },
              { name: '🧪 Nivel 80', value: 80 },
              { name: '🧪 Nivel 100', value: 100 },
              { name: '🧪 Nivel 120', value: 120 },
              { name: '🧪 Nivel 140', value: 140 },
              { name: '🧪 Nivel 160', value: 160 },
              { name: '🧪 Nivel 180', value: 180 },
              { name: '🧪 Nivel 200', value: 200 },
              { name: '❌ Quitar nivel', value: 0 }
            )
        )
        .addStringOption(opt =>
          opt.setName('descripcion')
            .setDescription('Nueva descripción')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('icono')
            .setDescription('Nueva URL de la imagen/icono (o escribe "quitar" para borrarlo)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('banner')
            .setDescription('Nueva URL del banner inferior (o escribe "quitar" para borrarlo)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('limite')
            .setDescription('Nuevo límite de personas (0 para sin límite)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('por_turno')
            .setDescription('Nuevos cupos simultáneos por turno')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('tarjeta')
        .setDescription('Publica en el chat la tarjeta interactiva navegable (⬅️ ➡️) visible para todos')
    )
    .addSubcommand(sub =>
      sub
        .setName('listar')
        .setDescription('Abre tu visor personal privado de colas')
    )
    .addSubcommand(sub =>
      sub
        .setName('siguiente')
        .setDescription('Pasa al siguiente participante en la cola')
        .addStringOption(opt =>
          opt.setName('cola')
            .setDescription('ID o nombre de la cola (opcional si solo hay una)')
            .setAutocomplete(true)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('atras')
        .setDescription('Revierte el último turno si se avanzó por error')
        .addStringOption(opt =>
          opt.setName('cola')
            .setDescription('ID o nombre de la cola (opcional si solo hay una)')
            .setAutocomplete(true)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reset')
        .setDescription('Limpia los turnos del día, vacía TODAS las colas y las deja cerradas para el siguiente ciclo')
    )
    .addSubcommand(sub =>
      sub
        .setName('abrir')
        .setDescription('Abre y reanuda las colas para permitir que los usuarios se unan')
        .addStringOption(opt =>
          opt.setName('cola')
            .setDescription('Cola específica a abrir (deja vacío para abrir TODAS en este canal)')
            .setAutocomplete(true)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('cerrar')
        .setDescription('Cierra las colas y vacía los participantes en espera')
        .addStringOption(opt =>
          opt.setName('cola')
            .setDescription('Cola específica a cerrar (deja vacío para cerrar TODAS)')
            .setAutocomplete(true)
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('vaciar')
            .setDescription('¿Vaciar también los turnos y la lista de espera? (Por defecto: Sí)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('vaciar')
        .setDescription('Vacía la lista de espera y los turnos activos de las colas')
        .addStringOption(opt =>
          opt.setName('cola')
            .setDescription('Cola específica a vaciar (deja vacío para vaciar TODAS)')
            .setAutocomplete(true)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('limpiar')
        .setDescription('Elimina mensajes ajenos de chat en este canal (mantiene intactos los paneles de cola)')
    )
    .addSubcommand(sub =>
      sub
        .setName('eliminar')
        .setDescription('Elimina permanentemente una cola y borra su mensaje del canal')
        .addStringOption(opt =>
          opt.setName('cola')
            .setDescription('Cola que deseas eliminar permanentemente')
            .setAutocomplete(true)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('insertar')
        .setDescription('Inserta a un usuario en una posición específica de la cola (desplaza a los demás)')
        .addUserOption(opt =>
          opt.setName('usuario')
            .setDescription('Usuario que deseas insertar en la cola')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('posicion')
            .setDescription('Puesto/número en la fila donde quieres colocarlo (ej: 1 para el primer lugar en espera)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('cola')
            .setDescription('Cola a modificar (opcional si solo hay una)')
            .setAutocomplete(true)
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('nota')
            .setDescription('Nota o motivo opcional (ej: AFK recuperado, DC)')
            .setRequired(false)
        )
    )
].map(cmd => cmd.toJSON());

// Helper para formatear timestamp nativo de Discord (<t:UNIX:t>)
// Esto permite que Discord muestre la hora regional de cada usuario automáticamente y active el tooltip al pasar el mouse
function formatDiscordTimestamp(dateVal, style = 't') {
  if (!dateVal) return '';
  const ms = typeof dateVal === 'number' ? dateVal : new Date(dateVal).getTime();
  if (isNaN(ms) || ms <= 0) return '';
  const unix = Math.floor(ms / 1000);
  return `<t:${unix}:${style}>`;
}

// Helper para obtener el color y badge según el nivel de poción/mazmorra
function getPotionInfo(potionLevel) {
  if (!potionLevel) return { badge: '', color: '#2B2D31', name: '' };
  const lvl = Number(potionLevel);
  if (lvl <= 60) {
    return { badge: `🧪 [Lv. ${lvl}]`, color: '#57F287', name: `Poción Nivel ${lvl}` }; // Verde (Inicial)
  }
  if (lvl <= 100) {
    return { badge: `🧪 [Lv. ${lvl}]`, color: '#5865F2', name: `Poción Nivel ${lvl}` }; // Azul Discord (Intermedio)
  }
  if (lvl <= 160) {
    return { badge: `🧪 [Lv. ${lvl}]`, color: '#FEE75C', name: `Poción Nivel ${lvl}` }; // Amarillo/Dorado (Alto)
  }
  return { badge: `🔥 [Lv. ${lvl}]`, color: '#EB459E', name: `Poción Nivel ${lvl}` }; // Fucsia/Épico (180-200)
}

// Construye el Embed visual de una cola (con formato de timestamps universales de Discord)
function buildQueueEmbed(queueData, pageInfo = null) {
  const {
    title,
    description,
    currentTurn,
    waitingList,
    maxCapacity,
    slotsPerTurn,
    lastAdvancedBy,
    pastTurns,
    iconUrl,
    bannerUrl,
    host,
    isClosed,
    potionLevel
  } = queueData;

  const currList = currentTurn || [];
  const waitList = waitingList || [];
  const totalInQueue = currList.length + waitList.length;
  const capacityStr = maxCapacity > 0 ? `${totalInQueue}/${maxCapacity}` : `${totalInQueue}`;

  // 1. Turno actual: Formato nativo interactivo con hora regional y tooltip de Discord
  let currentTurnText = '*(Nadie en turno)*';
  if (currList.length > 0) {
    const lines = currList.map(u => {
      const timeTag = formatDiscordTimestamp(u.turnStartTime || u.joinedAt);
      const timeStr = timeTag ? ` (${timeTag})` : '';
      const noteStr = u.note ? ` [${u.note}]` : '';
      const name = u.displayName || u.username || u.id;
      return `> 🟢 **@${name}**${noteStr}${timeStr}`;
    });
    currentTurnText = lines.join('\n');
  }

  // 2. Lista de espera con hora regional interactiva
  let waitingListText = '*(Vacía)*';
  if (waitList.length > 0) {
    const lines = [];
    let totalChars = 0;
    let truncatedCount = 0;

    for (let i = 0; i < waitList.length; i++) {
      const u = waitList[i];
      const noteStr = u.note ? ` [${u.note}]` : '';
      const numStr = String(i + 1).padStart(2, '0');
      const timeTag = formatDiscordTimestamp(u.joinedAt);
      const timeStr = timeTag ? ` (${timeTag})` : '';
      const name = u.displayName || u.username || u.id;
      const line = `**${numStr}.** @${name}${noteStr}${timeStr}`;
      
      if (totalChars + line.length > 900 || lines.length >= 10) {
        truncatedCount = waitList.length - i;
        break;
      }
      lines.push(line);
      totalChars += line.length + 1;
    }

    if (truncatedCount > 0) {
      lines.push(`*... (+${truncatedCount} más en fila)*`);
    }
    waitingListText = lines.join('\n');
  }

  // 3. Últimos turnos atendidos con hora regional interactiva
  let historyText = '*(Sin turnos previos)*';
  if (pastTurns && pastTurns.length > 0) {
    const recent = pastTurns.slice(-8).reverse();
    const lines = recent.map(u => {
      const timeTag = formatDiscordTimestamp(u.completedAt || u.turnStartTime || u.joinedAt);
      const timeStr = timeTag ? ` (${timeTag})` : '';
      const noteStr = u.note ? ` [${u.note}]` : '';
      const name = u.displayName || u.username || u.id;
      return `• @${name}${noteStr}${timeStr}`;
    });
    historyText = lines.join('\n');
  }

  const potion = getPotionInfo(potionLevel);
  const potionPrefix = potion.badge ? `${potion.badge} ` : '';
  let statusBadge = isClosed ? '🔒 CERRADA' : '🟢 ABIERTA';
  
  const embed = new EmbedBuilder()
    .setTitle(`${potionPrefix}${title || 'Cola de Turnos'} ${isClosed ? '🔒' : ''}`)
    .setColor(isClosed ? '#ED4245' : potion.color);

  let desc = description || '';
  if (isClosed) {
    desc = `*🔒 Cola cerrada temporalmente (Abre a las 18:00 hrs Chile o con /cola abrir).* \n${desc}`.trim();
  } else if (desc.trim().length > 0) {
    desc = `*${desc}*`;
  }

  if (desc.trim().length > 0) {
    embed.setDescription(desc);
  }

  if (iconUrl && iconUrl.startsWith('http')) {
    embed.setThumbnail(iconUrl);
  }

  if (bannerUrl && bannerUrl.startsWith('http')) {
    embed.setImage(bannerUrl);
  }

  // Columnas gemelas y limpias
  embed.addFields(
    { name: 'EN TURNO', value: currentTurnText, inline: false },
    { name: `EN COLA (${waitList.length})`, value: waitingListText, inline: true },
    { name: `TURNOS PASADOS (${pastTurns?.length || 0})`, value: historyText, inline: true }
  );

  if ((slotsPerTurn || 1) > 1) {
    embed.addFields({ name: 'POR TURNO', value: `${slotsPerTurn}`, inline: false });
  }

  // Footer: Estilo idéntico a la referencia
  const advancePart = lastAdvancedBy ? `Último avance por: @${lastAdvancedBy.username}` : `Estado: ${statusBadge}`;
  const totalPart = `Total anotados: ${capacityStr}`;
  const hostPart = host ? `Organizador: ${host.username || host}` : '';
  let footerText = `${advancePart}  •  ${totalPart}  •  ${hostPart}`;

  if (pageInfo) {
    footerText += `  •  [${pageInfo.current}/${pageInfo.total}]`;
  }

  embed.setFooter({ text: footerText });
  return embed;
}

// Botones interactivos estándar: EXACTAMENTE 4 BOTONES (Unirse, Salir, Siguiente, Atrás). Se removió Cerrar.
function buildQueueButtons(queueId, isClosed = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_join:${queueId}`)
      .setLabel('Unirse')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_leave:${queueId}`)
      .setLabel('Salir')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_next:${queueId}`)
      .setLabel('Siguiente')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_undo:${queueId}`)
      .setLabel('Atrás')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed)
  );

  return [row];
}

// Construye la TARJETA / VISOR NAVEGABLE estilo Mudae/Nekotina con paginación inteligente de 25+ colas
function buildCardViewerComponents(activeQueues, currentIndex) {
  const total = activeQueues.length;
  if (total === 0) return [];

  const safeIndex = Math.max(0, Math.min(currentIndex, total - 1));
  const currentQueue = activeQueues[safeIndex];
  const queueId = currentQueue.id;
  const isClosed = !!currentQueue.isClosed;

  // 1. Fila de Navegación (⬅️ ➡️ + Ir al inicio / final + Contador)
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`card_nav:first:${safeIndex}`)
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safeIndex === 0),
    new ButtonBuilder()
      .setCustomId(`card_nav:prev:${safeIndex}`)
      .setEmoji('◀️')
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(safeIndex === 0),
    new ButtonBuilder()
      .setCustomId(`card_nav:count:${safeIndex}`)
      .setLabel(`${safeIndex + 1} / ${total}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`card_nav:next:${safeIndex}`)
      .setEmoji('▶️')
      .setLabel('Siguiente')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(safeIndex >= total - 1),
    new ButtonBuilder()
      .setCustomId(`card_nav:last:${safeIndex}`)
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safeIndex >= total - 1)
  );

  // 2. Fila de Acciones directas sobre la cola que estás viendo + Asignar Nivel
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_join:${queueId}`)
      .setLabel('Unirme a esta')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_leave:${queueId}`)
      .setLabel('Salir')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_next:${queueId}`)
      .setLabel('Siguiente')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_setlvl_menu:${queueId}`)
      .setEmoji('🧪')
      .setLabel(currentQueue.potionLevel ? `Lv. ${currentQueue.potionLevel}` : 'Asignar Nivel')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn_hide:${queueId}`)
      .setLabel('Ocultar')
      .setStyle(ButtonStyle.Secondary)
  );

  // 3. Menú desplegable con PAGINACIÓN INTELIGENTE (Soporta ilimitadas colas sin sobrepasar el límite de 25 de Discord)
  const pageSize = 23;
  let selectOptions = [];

  if (total <= 25) {
    selectOptions = activeQueues.map((q, idx) => {
      const count = (q.currentTurn?.length || 0) + (q.waitingList?.length || 0);
      const lock = q.isClosed ? '🔒 ' : '';
      const lvlTag = q.potionLevel ? `[Lv. ${q.potionLevel}] ` : '';
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${idx + 1}. ${lock}${lvlTag}${q.title.length > 70 ? q.title.substring(0, 67) + '...' : q.title}`)
        .setDescription(`👥 Total: ${count} | 🟢 Turno: ${q.currentTurn?.length || 0} | ⏳ Cola: ${q.waitingList?.length || 0}`)
        .setValue(String(idx))
        .setDefault(idx === safeIndex);
    });
  } else {
    const currentChunkPage = Math.floor(safeIndex / pageSize);
    const totalChunkPages = Math.ceil(total / pageSize);
    const startIdx = currentChunkPage * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);

    if (currentChunkPage > 0) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`⬅️ Ver anteriores colas (Pág. ${currentChunkPage}/${totalChunkPages})`)
          .setDescription(`Volver a las colas 1 - ${startIdx}`)
          .setValue(`page_jump:${startIdx - pageSize}`)
      );
    }

    for (let idx = startIdx; idx < endIdx; idx++) {
      const q = activeQueues[idx];
      const count = (q.currentTurn?.length || 0) + (q.waitingList?.length || 0);
      const lock = q.isClosed ? '🔒 ' : '';
      const lvlTag = q.potionLevel ? `[Lv. ${q.potionLevel}] ` : '';
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${idx + 1}. ${lock}${lvlTag}${q.title.length > 70 ? q.title.substring(0, 67) + '...' : q.title}`)
          .setDescription(`👥 Total: ${count} | 🟢 Turno: ${q.currentTurn?.length || 0} | ⏳ Cola: ${q.waitingList?.length || 0}`)
          .setValue(String(idx))
          .setDefault(idx === safeIndex)
      );
    }

    if (endIdx < total) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`➡️ Ver más colas (Pág. ${currentChunkPage + 2}/${totalChunkPages})`)
          .setDescription(`Ver colas ${endIdx + 1} a ${Math.min(endIdx + pageSize, total)}`)
          .setValue(`page_jump:${endIdx}`)
      );
    }
  }

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('card_select_jump')
      .setPlaceholder('🔽 Saltar directamente a una cola...')
      .addOptions(selectOptions)
  );

  return [navRow, actionRow, selectRow];
}

// Actualiza el mensaje interactivo en Discord de forma segura y veloz (con caché de mensajes)
async function updateQueueMessage(queueData, channel) {
  if (!queueData || !queueData.messageId) return;
  try {
    const chan = await resolveChannel(queueData.channelId, channel);
    if (!chan) return;
    const msg = chan.messages.cache.get(queueData.messageId) || await chan.messages.fetch(queueData.messageId).catch(() => null);
    if (msg) {
      const embed = buildQueueEmbed(queueData);
      const components = buildQueueButtons(queueData.id, !!queueData.isClosed);
      await msg.edit({ embeds: [embed], components }).catch(err => {
        console.error('Error editando mensaje de cola:', err);
      });
    }
  } catch (err) {
    console.error('Error en updateQueueMessage:', err);
  }
}

// Manejo de errores globales y caídas no controladas para evitar que el bot se apague
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [WARNING] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('❌ [ERROR] Uncaught Exception:', err, origin);
});

client.on('error', (err) => {
  console.error('🌐 [DISCORD CLIENT ERROR]:', err);
});

// Al encender el bot
client.once('clientReady', async () => {
  console.log(`==============================================`);
  console.log(`✅ Bot ONLINE y conectado como: ${client.user.tag}`);
  console.log(`==============================================`);

  loadQueues();

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('🔄 Registrando comandos Slash (/cola)...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: slashCommands }
    );
    console.log('✅ Comandos Slash registrados con éxito en Discord.');
  } catch (err) {
    console.error('❌ Error registrando comandos Slash:', err);
  }

  // Tarea de verificación periódica (cada 15 segundos) para aperturas automáticas a las 18:00 (Chile)
  let lastAutoOpenedDay = '';
  setInterval(async () => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const day = parts.find(p => p.type === 'day')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const year = parts.find(p => p.type === 'year')?.value || '';
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

      const todayKey = `${year}-${month}-${day}`;

      // Si son las 18:00 hrs o más tarde (Hora Chile) y no se ha ejecutado hoy
      if (hour >= 18 && lastAutoOpenedDay !== todayKey) {
        lastAutoOpenedDay = todayKey;
        console.log(`⏰ [AUTO-APERTURA] Son las ${hour}:${String(minute).padStart(2, '0')} hrs (Chile). Reanudando y abriendo todas las colas activas...`);

        // Modificar estado de todas en memoria inmediatamente
        for (const q of queues.values()) {
          q.isClosed = false;
        }
        saveQueues();

        // Actualizar mensajes en Discord en paralelo veloz
        const queueList = Array.from(queues.values());
        await Promise.allSettled(
          queueList.map(async (q) => {
            try {
              const chan = await resolveChannel(q.channelId, null);
              if (chan) {
                await updateQueueMessage(q, chan);
              }
            } catch (err) {
              console.error(`[AUTO-APERTURA] Error al actualizar cola "${q.title}":`, err);
            }
          })
        );
        console.log(`✅ [AUTO-APERTURA] Se abrieron con éxito ${queueList.length} cola(s).`);
      }
    } catch (e) {
      console.error('Error en cron de auto-apertura:', e);
    }
  }, 15 * 1000);
});

// Manejador de interacciones
client.on('interactionCreate', async (interaction) => {
  try {
    const channelId = interaction.channelId || interaction.channel?.id;
    const user = interaction.user;

    // 1. AUTOCOMPLETE para slash commands
    if (interaction.isAutocomplete()) {
      const focusedValue = interaction.options.getFocused().toLowerCase();
      const channelQueues = getQueuesInChannel(channelId);
      const filtered = channelQueues.filter(q =>
        q.title.toLowerCase().includes(focusedValue) || q.id.toLowerCase().includes(focusedValue)
      );

      return await interaction.respond(
        filtered.slice(0, 25).map(q => ({
          name: `${q.isClosed ? '🔒 ' : ''}${q.title} (${(q.currentTurn?.length || 0) + (q.waitingList?.length || 0)} personas)`,
          value: q.id
        }))
      );
    }

    // 2. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      const { commandName, options } = interaction;

      if (commandName === 'cola') {
        const subcommand = options.getSubcommand();

        // CREAR COLA
        if (subcommand === 'crear') {
          const title = options.getString('titulo');
          const potionLevel = options.getInteger('nivel') || null;
          const description = options.getString('descripcion') || '';
          const maxCapacity = options.getInteger('limite') || 0;
          const slotsPerTurn = options.getInteger('por_turno') || 1;
          const iconUrl = options.getString('icono') || null;
          const bannerUrl = options.getString('banner') || null;
          const queueId = `q_${Date.now()}`;

          const queueData = {
            id: queueId,
            title,
            potionLevel,
            description,
            iconUrl,
            bannerUrl,
            hostId: user.id,
            host: { id: user.id, username: user.username },
            maxCapacity,
            slotsPerTurn,
            isClosed: false,
            createdAt: new Date().toISOString(),
            currentTurn: [],
            waitingList: [],
            pastTurns: [],
            history: [],
            lastAdvancedBy: null,
            channelId: channelId,
            messageId: null
          };

          const embed = buildQueueEmbed(queueData);
          const components = buildQueueButtons(queueId, false);

          const message = await interaction.reply({
            embeds: [embed],
            components,
            fetchReply: true
          });

          queueData.messageId = message.id;
          queues.set(queueId, queueData);
          saveQueues();
          return;
        }

        // MOSTRAR
        if (subcommand === 'mostrar') {
          const targetQueueId = options.getString('cola');
          const queueData = queues.get(targetQueueId);

          if (!queueData) {
            return interaction.reply({
              content: 'No se encontró la cola especificada.',
              flags: [MessageFlags.Ephemeral]
            });
          }

          const chan = await resolveChannel(queueData.channelId, interaction.channel);
          if (chan && queueData.messageId) {
            try {
              const oldMsg = await chan.messages.fetch(queueData.messageId).catch(() => null);
              if (oldMsg) await oldMsg.delete().catch(() => {});
            } catch {}
          }

          const embed = buildQueueEmbed(queueData);
          const components = buildQueueButtons(queueData.id, !!queueData.isClosed);

          const newMsg = await interaction.reply({
            embeds: [embed],
            components,
            fetchReply: true
          });

          queueData.messageId = newMsg.id;
          queueData.channelId = channelId;
          saveQueues();
          return;
        }

        // EDITAR
        if (subcommand === 'editar') {
          const targetQueueId = options.getString('cola');
          const queueData = queues.get(targetQueueId);

          if (!queueData) {
            return interaction.reply({
              content: 'No se encontró la cola especificada.',
              flags: [MessageFlags.Ephemeral]
            });
          }

          const newTitle = options.getString('titulo');
          const newLevel = options.getInteger('nivel');
          const newDesc = options.getString('descripcion');
          const newIcon = options.getString('icono');
          const newBanner = options.getString('banner');
          const newLimit = options.getInteger('limite');
          const newSlots = options.getInteger('por_turno');

          if (newTitle !== null) queueData.title = newTitle;
          if (newLevel !== null) queueData.potionLevel = newLevel === 0 ? null : newLevel;
          if (newDesc !== null) queueData.description = newDesc;
          if (newIcon !== null) queueData.iconUrl = newIcon.toLowerCase() === 'quitar' ? null : newIcon;
          if (newBanner !== null) queueData.bannerUrl = newBanner.toLowerCase() === 'quitar' ? null : newBanner;
          if (newLimit !== null) queueData.maxCapacity = newLimit;
          if (newSlots !== null) queueData.slotsPerTurn = newSlots;

          saveQueues();
          const chan = await resolveChannel(queueData.channelId, interaction.channel);
          await updateQueueMessage(queueData, chan);

          const levelNotice = newLevel !== null ? (newLevel > 0 ? ` (Nivel asignado: Lv. ${newLevel})` : ' (Nivel removido)') : '';
          return interaction.reply({
            content: `✅ Se actualizó la cola **${queueData.title}** exitosamente${levelNotice}.`,
            flags: [MessageFlags.Ephemeral]
          });
        }

        // TARJETA
        if (subcommand === 'tarjeta') {
          const active = getQueuesInChannel(channelId);
          if (active.length === 0) {
            return interaction.reply({
              content: 'No hay ninguna cola activa en este canal.',
              flags: [MessageFlags.Ephemeral]
            });
          }

          const firstIndex = 0;
          const currentQueue = active[firstIndex];
          const embed = buildQueueEmbed(currentQueue, { current: 1, total: active.length });
          const components = buildCardViewerComponents(active, firstIndex);

          return interaction.reply({
            content: `🗂️ **Tarjeta interactiva de colas** (Cualquiera puede navegar con ◀️ y ▶️ o unirse):`,
            embeds: [embed],
            components
          });
        }

        // LISTAR
        if (subcommand === 'listar') {
          const active = getQueuesInChannel(channelId);
          if (active.length === 0) {
            return interaction.reply({
              content: 'No hay ninguna cola activa en este canal.',
              flags: [MessageFlags.Ephemeral]
            });
          }

          const firstIndex = 0;
          const currentQueue = active[firstIndex];
          const embed = buildQueueEmbed(currentQueue, { current: 1, total: active.length });
          const components = buildCardViewerComponents(active, firstIndex);

          return interaction.reply({
            content: `🗂️ **Tu visor privado de colas** (Solo tú lo ves):`,
            embeds: [embed],
            components,
            flags: [MessageFlags.Ephemeral]
          });
        }

        // SIGUIENTE
        if (subcommand === 'siguiente') {
          const targetQueueId = options.getString('cola');
          let queueData = null;

          if (targetQueueId) {
            queueData = queues.get(targetQueueId);
          } else {
            const channelQueues = getQueuesInChannel(channelId);
            if (channelQueues.length === 1) {
              queueData = channelQueues[0];
            } else if (channelQueues.length > 1) {
              return interaction.reply({
                content: `Hay ${channelQueues.length} colas activas en este canal. Usa el botón **Siguiente** en la tarjeta o usa \`/cola siguiente cola:<nombre>\`.`,
                flags: [MessageFlags.Ephemeral]
              });
            }
          }

          if (!queueData) {
            return interaction.reply({ content: 'No se encontró la cola especificada.', flags: [MessageFlags.Ephemeral] });
          }

          const chan = await resolveChannel(channelId, interaction.channel);
          await advanceQueue(queueData, user, chan, interaction.guild);
          saveQueues();
          await updateQueueMessage(queueData, chan);
          return interaction.reply({ content: `Turno avanzado en **${queueData.title}** por <@${user.id}>.`, flags: [MessageFlags.Ephemeral] });
        }

        // ATRÁS
        if (subcommand === 'atras') {
          const targetQueueId = options.getString('cola');
          let queueData = null;

          if (targetQueueId) {
            queueData = queues.get(targetQueueId);
          } else {
            const channelQueues = getQueuesInChannel(channelId);
            if (channelQueues.length === 1) {
              queueData = channelQueues[0];
            } else if (channelQueues.length > 1) {
              return interaction.reply({
                content: `Hay ${channelQueues.length} colas activas en este canal. Usa el botón **Atrás** de la cola deseada o especifícala con el comando.`,
                flags: [MessageFlags.Ephemeral]
              });
            }
          }

          if (!queueData) {
            return interaction.reply({ content: 'No se encontró la cola especificada.', flags: [MessageFlags.Ephemeral] });
          }

          const chan = await resolveChannel(channelId, interaction.channel);
          const reverted = await undoQueue(queueData, chan);
          if (!reverted) {
            return interaction.reply({ content: `No hay turnos anteriores para revertir en **${queueData.title}**.`, flags: [MessageFlags.Ephemeral] });
          }
          saveQueues();
          await updateQueueMessage(queueData, chan);
          return interaction.reply({ content: `Turno revertido en **${queueData.title}** por <@${user.id}>.`, flags: [MessageFlags.Ephemeral] });
        }

        // RESET (Limpia turnos del día de TODAS las colas, las vacía y las deja cerradas para el próximo ciclo)
        if (subcommand === 'reset') {
          // Defer inmediato para evitar timeout de 3 segundos
          await interaction.deferReply();

          // Obtener todas las colas registradas
          const allGuildQueues = Array.from(queues.values()).filter(q => !q.guildId || q.guildId === interaction.guildId);
          const targetList = allGuildQueues.length > 0 ? allGuildQueues : Array.from(queues.values());

          if (targetList.length === 0) {
            return interaction.editReply({ content: 'No hay ninguna cola registrada para reiniciar.' });
          }

          // 1. Limpiar estado en memoria al instante
          for (const q of targetList) {
            q.currentTurn = [];
            q.waitingList = [];
            q.pastTurns = [];
            q.history = [];
            q.lastAdvancedBy = null;
            q.isClosed = true; // Queda cerrada hasta las 18:00 o hasta /cola abrir
          }
          saveQueues();

          // 2. Actualizar mensajes de Discord en paralelo sin bloquear
          await Promise.allSettled(
            targetList.map(async (q) => {
              try {
                const chan = await resolveChannel(q.channelId, interaction.channel);
                if (chan) {
                  await updateQueueMessage(q, chan);
                }
              } catch (err) {
                console.error(`Error al actualizar mensaje de cola ${q.title} en reset:`, err);
              }
            })
          );

          const replyPromise = interaction.editReply({
            content: `🧹 **Reinicio Diario Completado:** Se han limpiado los turnos activos, la lista de espera y el historial de **todas las colas** (${targetList.length} en total). Han quedado cerradas y se abrirán automáticamente a las **18:00 (Chile)** o cuando uses \`/cola abrir\`.`
          });
          autoDeleteReply(interaction, 12);
          return replyPromise;
        }

        // ABRIR (Abre/reanuda manualmente las colas)
        if (subcommand === 'abrir') {
          await interaction.deferReply();
          const targetQueueId = options.getString('cola');
          let targetList = [];

          if (targetQueueId) {
            const q = queues.get(targetQueueId);
            if (q) targetList.push(q);
          } else {
            targetList = getQueuesInChannel(channelId);
          }

          if (targetList.length === 0) {
            const replyPromise = interaction.editReply({ content: 'No se encontraron colas para abrir en este canal.' });
            autoDeleteReply(interaction, 8);
            return replyPromise;
          }

          for (const q of targetList) {
            q.isClosed = false;
          }
          saveQueues();

          await Promise.allSettled(
            targetList.map(async (q) => {
              try {
                const chan = await resolveChannel(q.channelId, interaction.channel);
                if (chan) {
                  await updateQueueMessage(q, chan);
                }
              } catch (err) {
                console.error(`Error al abrir cola ${q.title}:`, err);
              }
            })
          );

          const replyPromise = interaction.editReply({
            content: `🟢 **Colas abiertas:** Se ha reanudado la recepción de participantes en ${targetList.length} cola(s). ¡Ya pueden unirse!`
          });
          autoDeleteReply(interaction, 10);
          return replyPromise;
        }

        // CERRAR (Cierra las colas y vacía los participantes)
        if (subcommand === 'cerrar') {
          await interaction.deferReply();
          const targetQueueId = options.getString('cola');
          const shouldVaciar = options.getBoolean('vaciar') ?? true; // Por defecto SÍ vacía
          let targetList = [];

          if (targetQueueId) {
            const q = queues.get(targetQueueId);
            if (q) targetList.push(q);
          } else {
            targetList = getQueuesInChannel(channelId);
            if (targetList.length === 0) {
              const allGuild = Array.from(queues.values()).filter(q => !q.guildId || q.guildId === interaction.guildId);
              targetList = allGuild.length > 0 ? allGuild : Array.from(queues.values());
            }
          }

          if (targetList.length === 0) {
            const replyPromise = interaction.editReply({ content: 'No se encontraron colas para cerrar.' });
            autoDeleteReply(interaction, 8);
            return replyPromise;
          }

          for (const q of targetList) {
            q.isClosed = true;
            if (shouldVaciar) {
              q.currentTurn = [];
              q.waitingList = [];
              q.lastAdvancedBy = null;
            }
          }
          saveQueues();

          await Promise.allSettled(
            targetList.map(async (q) => {
              try {
                const chan = await resolveChannel(q.channelId, interaction.channel);
                if (chan) {
                  await updateQueueMessage(q, chan);
                }
              } catch (err) {
                console.error(`Error al actualizar cola ${q.title}:`, err);
              }
            })
          );

          const vaciarMsg = shouldVaciar ? ' y se han **vaciado los turnos activos y la lista de espera**' : '';
          const replyPromise = interaction.editReply({
            content: `🔒 **Colas cerradas:** Se ha pausado la recepción de participantes en **${targetList.length} cola(s)**${vaciarMsg}. Para reabrir usa \`/cola abrir\`.`
          });
          autoDeleteReply(interaction, 10);
          return replyPromise;
        }

        // VACIAR (Vacía la lista de espera y los turnos activos)
        if (subcommand === 'vaciar') {
          await interaction.deferReply();
          const targetQueueId = options.getString('cola');
          let targetList = [];

          if (targetQueueId) {
            const q = queues.get(targetQueueId);
            if (q) targetList.push(q);
          } else {
            targetList = getQueuesInChannel(channelId);
            if (targetList.length === 0) {
              const allGuild = Array.from(queues.values()).filter(q => !q.guildId || q.guildId === interaction.guildId);
              targetList = allGuild.length > 0 ? allGuild : Array.from(queues.values());
            }
          }

          if (targetList.length === 0) {
            const replyPromise = interaction.editReply({ content: 'No se encontraron colas para vaciar.' });
            autoDeleteReply(interaction, 8);
            return replyPromise;
          }

          for (const q of targetList) {
            q.currentTurn = [];
            q.waitingList = [];
            q.lastAdvancedBy = null;
          }
          saveQueues();

          await Promise.allSettled(
            targetList.map(async (q) => {
              try {
                const chan = await resolveChannel(q.channelId, interaction.channel);
                if (chan) {
                  await updateQueueMessage(q, chan);
                }
              } catch (err) {
                console.error(`Error al actualizar cola ${q.title}:`, err);
              }
            })
          );

          const replyPromise = interaction.editReply({
            content: `🗑️ **Colas vaciadas:** Se han limpiado los turnos activos y la lista de espera de **${targetList.length} cola(s)**.`
          });
          autoDeleteReply(interaction, 10);
          return replyPromise;
        }

        // LIMPIAR (Elimina mensajes ajenos de chat en el canal de la cola)
        if (subcommand === 'limpiar') {
          await interaction.deferReply();
          const chan = await resolveChannel(channelId, interaction.channel);
          const deletedCount = await cleanChannelExtraneousMessages(chan, 100);

          const replyPromise = interaction.editReply({
            content: `🧹 **Canal limpiado:** Se han eliminado **${deletedCount}** mensaje(s) ajenos. Los paneles oficiales de las colas se mantienen intactos.`
          });
          autoDeleteReply(interaction, 10);
          return replyPromise;
        }

        // ELIMINAR (Borra permanentemente la cola y su mensaje)
        if (subcommand === 'eliminar') {
          const targetQueueId = options.getString('cola');
          const queueData = queues.get(targetQueueId);

          if (!queueData) {
            return interaction.reply({ content: 'No se encontró la cola especificada.', flags: [MessageFlags.Ephemeral] });
          }

          const chan = await resolveChannel(queueData.channelId, interaction.channel);
          if (chan && queueData.messageId) {
            try {
              const msg = await chan.messages.fetch(queueData.messageId).catch(() => null);
              if (msg) await msg.delete().catch(() => {});
            } catch {}
          }

          const queueTitle = queueData.title;
          queues.delete(targetQueueId);
          saveQueues();

          return interaction.reply({
            content: `🗑️ La cola **${queueTitle}** ha sido eliminada permanentemente.`,
            flags: [MessageFlags.Ephemeral]
          });
        }

        // INSERTAR (Mete a un usuario en una posición específica desplazando a los demás)
        if (subcommand === 'insertar') {
          const targetUser = options.getUser('usuario');
          const targetPos = options.getInteger('posicion');
          const note = options.getString('nota') || '';
          const targetQueueId = options.getString('cola');

          let queueData = null;
          if (targetQueueId) {
            queueData = queues.get(targetQueueId);
          } else {
            const channelQueues = getQueuesInChannel(channelId);
            if (channelQueues.length === 1) {
              queueData = channelQueues[0];
            } else if (channelQueues.length > 1) {
              return interaction.reply({
                content: `Hay ${channelQueues.length} colas activas. Especifica cuál con la opción \`cola\`.`,
                flags: [MessageFlags.Ephemeral]
              });
            }
          }

          if (!queueData) {
            return interaction.reply({ content: 'No se encontró la cola especificada.', flags: [MessageFlags.Ephemeral] });
          }

          if (targetPos < 1) {
            return interaction.reply({ content: 'La posición debe ser 1 o superior.', flags: [MessageFlags.Ephemeral] });
          }

          // Obtener el apodo más exacto del usuario en el servidor
          const displayName = await getMemberDisplayName(interaction.guild, targetUser);

          const participant = {
            id: targetUser.id,
            username: targetUser.username,
            displayName: displayName,
            joinedAt: Date.now(),
            turnStartTime: Date.now(),
            note: note
          };

          if (!queueData.waitingList) queueData.waitingList = [];
          if (!queueData.currentTurn) queueData.currentTurn = [];

          // Removerlo si ya estaba en algún lugar para no duplicar
          queueData.waitingList = queueData.waitingList.filter(u => u.id !== targetUser.id);
          queueData.currentTurn = queueData.currentTurn.filter(u => u.id !== targetUser.id);

          // Si la posición solicitada es mayor a la lista actual, simplemente se agrega al final
          const insertIndex = Math.min(targetPos - 1, queueData.waitingList.length);
          queueData.waitingList.splice(insertIndex, 0, participant);

          saveQueues();
          const chan = await resolveChannel(channelId, interaction.channel);
          await updateQueueMessage(queueData, chan);

          const replyPromise = interaction.reply({
            content: `📌 <@${targetUser.id}> (${displayName}) ha sido insertado en la **Posición #${insertIndex + 1}** de la cola **${queueData.title}**${note ? ` con la nota: \`${note}\`` : ''}. Los participantes detrás han sido desplazados automáticamente.`
          });
          autoDeleteReply(interaction, 12);
          return replyPromise;
        }
      }
    }

    // 3. SELECT MENUS
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      // SALTAR A COLA O CAMBIAR DE PÁGINA EN EL VISOR
      if (customId === 'card_select_jump') {
        const selectedVal = interaction.values[0];
        const active = getQueuesInChannel(channelId);

        if (active.length === 0) {
          return interaction.update({
            content: 'No hay colas activas en este canal.',
            embeds: [],
            components: []
          });
        }

        // Si es salto de página
        if (selectedVal.startsWith('page_jump:')) {
          const targetIndex = parseInt(selectedVal.split(':')[1], 10) || 0;
          const safeIndex = Math.max(0, Math.min(targetIndex, active.length - 1));
          const currentQueue = active[safeIndex];

          const embed = buildQueueEmbed(currentQueue, { current: safeIndex + 1, total: active.length });
          const components = buildCardViewerComponents(active, safeIndex);
          return interaction.update({ embeds: [embed], components });
        }

        // Salto a cola específica
        const targetIndex = parseInt(selectedVal, 10) || 0;
        const safeIndex = Math.max(0, Math.min(targetIndex, active.length - 1));
        const currentQueue = active[safeIndex];

        const embed = buildQueueEmbed(currentQueue, { current: safeIndex + 1, total: active.length });
        const components = buildCardViewerComponents(active, safeIndex);
        return interaction.update({ embeds: [embed], components });
      }

      // ASIGNAR NIVEL DE POCIÓN DESDE EL DESPLEGABLE RÁPIDO
      if (customId.startsWith('select_set_potion:')) {
        const queueId = customId.split(':')[1];
        const queueData = queues.get(queueId);

        if (!queueData) {
          return interaction.reply({
            content: 'Esta cola ya no existe.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const selectedLvl = parseInt(interaction.values[0], 10);
        queueData.potionLevel = selectedLvl > 0 ? selectedLvl : null;
        saveQueues();

        const chan = await resolveChannel(queueData.channelId, interaction.channel);
        await updateQueueMessage(queueData, chan);

        // Si la interacción viene de la tarjeta navegable, refrescamos la tarjeta
        const active = getQueuesInChannel(channelId);
        const currentIndex = active.findIndex(q => q.id === queueId);
        if (currentIndex !== -1 && interaction.message.interaction?.commandName === undefined) {
          const embed = buildQueueEmbed(queueData, { current: currentIndex + 1, total: active.length });
          const components = buildCardViewerComponents(active, currentIndex);
          try {
            await interaction.message.edit({ embeds: [embed], components });
          } catch {}
        }

        return interaction.reply({
          content: selectedLvl > 0
            ? `🧪 Se asignó el nivel **Lv. ${selectedLvl}** a la cola **${queueData.title}**.`
            : `❌ Se removió la etiqueta de nivel de la cola **${queueData.title}**.`,
          flags: [MessageFlags.Ephemeral]
        });
      }
    }

    // 4. BOTONES INTERACTIVOS
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // MENÚ RÁPIDO PARA ASIGNAR NIVEL DE POCIÓN (20 a 200)
      if (customId.startsWith('btn_setlvl_menu:')) {
        const queueId = customId.split(':')[1];
        const queueData = queues.get(queueId);

        if (!queueData) {
          return interaction.reply({ content: 'Cola no encontrada.', flags: [MessageFlags.Ephemeral] });
        }

        const levelOptions = [
          { label: '🧪 Poción Nivel 20 (Inicial)', value: '20', description: 'Para recaudadores en zonas lvl 20' },
          { label: '🧪 Poción Nivel 40', value: '40', description: 'Para recaudadores en zonas lvl 40' },
          { label: '🧪 Poción Nivel 60', value: '60', description: 'Para recaudadores en zonas lvl 60' },
          { label: '🧪 Poción Nivel 80', value: '80', description: 'Para recaudadores en zonas lvl 80' },
          { label: '🧪 Poción Nivel 100 (Intermedio)', value: '100', description: 'Para recaudadores en zonas lvl 100' },
          { label: '🧪 Poción Nivel 120', value: '120', description: 'Para recaudadores en zonas lvl 120' },
          { label: '🧪 Poción Nivel 140', value: '140', description: 'Para recaudadores en zonas lvl 140' },
          { label: '🧪 Poción Nivel 160 (Alto)', value: '160', description: 'Para recaudadores en zonas lvl 160' },
          { label: '🔥 Poción Nivel 180 (Endgame)', value: '180', description: 'Para recaudadores en zonas lvl 180' },
          { label: '🔥 Poción Nivel 200 (Épico)', value: '200', description: 'Para recaudadores en mazmorras y zonas lvl 200' },
          { label: '❌ Quitar Nivel / Sin Nivel', value: '0', description: 'Restablece la cola a formato general' },
        ].map(opt => {
          const isDef = (queueData.potionLevel || 0) === parseInt(opt.value, 10);
          return new StringSelectMenuOptionBuilder()
            .setLabel(opt.label)
            .setValue(opt.value)
            .setDescription(opt.description)
            .setDefault(isDef);
        });

        const levelSelectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`select_set_potion:${queueId}`)
            .setPlaceholder('🧪 Elige el nivel de la poción / mazmorra...')
            .addOptions(levelOptions)
        );

        return interaction.reply({
          content: `🏷️ **Configurar Nivel para "${queueData.title}":**\nSelecciona el nivel correspondiente para asignar color temático y badge automático:`,
          components: [levelSelectRow],
          flags: [MessageFlags.Ephemeral]
        });
      }

      // NAVEGACIÓN EN LA TARJETA PÚBLICA / PRIVADA
      if (customId.startsWith('card_nav:')) {
        const [, direction, currentIndexStr] = customId.split(':');
        const currentIndex = parseInt(currentIndexStr, 10) || 0;
        const active = getQueuesInChannel(channelId);

        if (active.length === 0) {
          return interaction.update({
            content: 'No hay colas activas en este canal.',
            embeds: [],
            components: []
          });
        }

        let newIndex = currentIndex;
        if (direction === 'prev') newIndex = Math.max(0, currentIndex - 1);
        if (direction === 'next') newIndex = Math.min(active.length - 1, currentIndex + 1);
        if (direction === 'first') newIndex = 0;
        if (direction === 'last') newIndex = active.length - 1;

        const currentQueue = active[newIndex];
        const embed = buildQueueEmbed(currentQueue, { current: newIndex + 1, total: active.length });
        const components = buildCardViewerComponents(active, newIndex);

        return interaction.update({ embeds: [embed], components });
      }

      // OCULTAR TARJETA
      if (customId.startsWith('btn_hide:')) {
        return interaction.message.delete().catch(() => {
          interaction.reply({ content: 'Tarjeta oculta.', flags: [MessageFlags.Ephemeral] });
        });
      }

      // ACCIONES DE COLA: UNIRSE, SALIR, SIGUIENTE, ATRAS
      const [action, queueId] = customId.split(':');
      const queueData = queues.get(queueId);

      if (!queueData) {
        return interaction.reply({
          content: 'Esta cola ya no existe o fue finalizada.',
          flags: [MessageFlags.Ephemeral]
        });
      }

      const chan = await resolveChannel(queueData.channelId, interaction.channel);

      // UNIRSE
      if (action === 'btn_join') {
        if (queueData.isClosed) {
          return interaction.reply({
            content: `🔒 La cola **${queueData.title}** está cerrada temporalmente. Se reanudará automáticamente a las 18:00 (Chile) o cuando un moderador use \`/cola abrir\`.`,
            flags: [MessageFlags.Ephemeral]
          });
        }

        const inTurn = (queueData.currentTurn || []).some(u => u.id === user.id);
        const inWait = (queueData.waitingList || []).some(u => u.id === user.id);

        if (inTurn) {
          return interaction.reply({ content: `Ya estás en tu turno actualmente en **${queueData.title}**.`, flags: [MessageFlags.Ephemeral] });
        }
        if (inWait) {
          const pos = queueData.waitingList.findIndex(u => u.id === user.id) + 1;
          return interaction.reply({ content: `Ya estás en la cola **${queueData.title}** en la posición #${pos}.`, flags: [MessageFlags.Ephemeral] });
        }

        const totalIn = (queueData.currentTurn?.length || 0) + (queueData.waitingList?.length || 0);
        if (queueData.maxCapacity > 0 && totalIn >= queueData.maxCapacity) {
          return interaction.reply({ content: `La cola **${queueData.title}** ha alcanzado su límite máximo de cupos.`, flags: [MessageFlags.Ephemeral] });
        }

        const memberName = await getMemberDisplayName(interaction.guild, user, interaction.member);
        const participant = {
          id: user.id,
          username: user.username,
          displayName: memberName,
          joinedAt: Date.now(),
          turnStartTime: Date.now(),
          note: ''
        };

        if (!queueData.currentTurn) queueData.currentTurn = [];
        if (!queueData.waitingList) queueData.waitingList = [];

        if (queueData.currentTurn.length < (queueData.slotsPerTurn || 1)) {
          queueData.currentTurn.push(participant);
        } else {
          queueData.waitingList.push(participant);
        }

        saveQueues();
        if (interaction.message.id !== queueData.messageId) {
          await updateQueueMessage(queueData, chan);
        }

        if (interaction.message.components?.length === 3) {
          const active = getQueuesInChannel(channelId);
          const currentIndex = active.findIndex(q => q.id === queueData.id);
          const safeIndex = currentIndex === -1 ? 0 : currentIndex;
          const embed = buildQueueEmbed(queueData, { current: safeIndex + 1, total: active.length });
          const components = buildCardViewerComponents(active, safeIndex);
          await interaction.update({ embeds: [embed], components });
        } else {
          const updatedEmbed = buildQueueEmbed(queueData);
          const components = buildQueueButtons(queueData.id, !!queueData.isClosed);
          await interaction.update({ embeds: [updatedEmbed], components });
        }
        return;
      }

      // SALIR
      if (action === 'btn_leave') {
        const waitIndex = (queueData.waitingList || []).findIndex(u => u.id === user.id);
        const turnIndex = (queueData.currentTurn || []).findIndex(u => u.id === user.id);

        if (waitIndex === -1 && turnIndex === -1) {
          return interaction.reply({ content: `No estás anotado en **${queueData.title}**.`, flags: [MessageFlags.Ephemeral] });
        }

        if (waitIndex !== -1) queueData.waitingList.splice(waitIndex, 1);
        if (turnIndex !== -1) {
          queueData.currentTurn.splice(turnIndex, 1);
          if (queueData.waitingList && queueData.waitingList.length > 0) {
            const next = queueData.waitingList.shift();
            next.turnStartTime = Date.now();
            queueData.currentTurn.push(next);
            notifyUserTurn(next, queueData, chan, null);
          }
        }

        saveQueues();
        if (interaction.message.id !== queueData.messageId) {
          await updateQueueMessage(queueData, chan);
        }

        if (interaction.message.components?.length === 3) {
          const active = getQueuesInChannel(channelId);
          const currentIndex = active.findIndex(q => q.id === queueData.id);
          const safeIndex = currentIndex === -1 ? 0 : currentIndex;
          const embed = buildQueueEmbed(queueData, { current: safeIndex + 1, total: active.length });
          const components = buildCardViewerComponents(active, safeIndex);
          await interaction.update({ embeds: [embed], components });
        } else {
          const updatedEmbed = buildQueueEmbed(queueData);
          const components = buildQueueButtons(queueData.id, !!queueData.isClosed);
          await interaction.update({ embeds: [updatedEmbed], components });
        }
        return;
      }

      // SIGUIENTE
      if (action === 'btn_next') {
        if ((!queueData.waitingList || queueData.waitingList.length === 0) && (!queueData.currentTurn || queueData.currentTurn.length === 0)) {
          return interaction.reply({ content: `La cola **${queueData.title}** está vacía.`, flags: [MessageFlags.Ephemeral] });
        }

        await advanceQueue(queueData, user, chan, interaction.guild);
        saveQueues();
        if (interaction.message.id !== queueData.messageId) {
          await updateQueueMessage(queueData, chan);
        }

        if (interaction.message.components?.length === 3) {
          const active = getQueuesInChannel(channelId);
          const currentIndex = active.findIndex(q => q.id === queueData.id);
          const safeIndex = currentIndex === -1 ? 0 : currentIndex;
          const embed = buildQueueEmbed(queueData, { current: safeIndex + 1, total: active.length });
          const components = buildCardViewerComponents(active, safeIndex);
          await interaction.update({ embeds: [embed], components });
        } else {
          const updatedEmbed = buildQueueEmbed(queueData);
          const components = buildQueueButtons(queueData.id, !!queueData.isClosed);
          await interaction.update({ embeds: [updatedEmbed], components });
        }
        return;
      }

      // ATRÁS
      if (action === 'btn_undo') {
        const reverted = await undoQueue(queueData, chan);
        if (!reverted) {
          return interaction.reply({
            content: `No hay turnos anteriores para revertir en **${queueData.title}**.`,
            flags: [MessageFlags.Ephemeral]
          });
        }

        saveQueues();
        if (interaction.message.id !== queueData.messageId) {
          await updateQueueMessage(queueData, chan);
        }

        if (interaction.message.components?.length === 3) {
          const active = getQueuesInChannel(channelId);
          const currentIndex = active.findIndex(q => q.id === queueData.id);
          const safeIndex = currentIndex === -1 ? 0 : currentIndex;
          const embed = buildQueueEmbed(queueData, { current: safeIndex + 1, total: active.length });
          const components = buildCardViewerComponents(active, safeIndex);
          await interaction.update({ embeds: [embed], components });
        } else {
          const updatedEmbed = buildQueueEmbed(queueData);
          const components = buildQueueButtons(queueData.id, !!queueData.isClosed);
          await interaction.update({ embeds: [updatedEmbed], components });
        }
        return;
      }
    }
  } catch (err) {
    console.error('❌ Error en el manejador de interacciones:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Ocurrió un error temporal al procesar la acción.',
          flags: [MessageFlags.Ephemeral]
        });
      }
    } catch {}
  }
});

// Avanza la cola guardando snapshot
async function advanceQueue(queueData, user, channel, guild = null) {
  if (!queueData.history) queueData.history = [];
  if (!queueData.pastTurns) queueData.pastTurns = [];
  if (!queueData.currentTurn) queueData.currentTurn = [];
  if (!queueData.waitingList) queueData.waitingList = [];

  // Guardar snapshot del estado previo
  queueData.history.push({
    currentTurn: JSON.parse(JSON.stringify(queueData.currentTurn)),
    waitingListIds: queueData.waitingList.map(u => u.id),
    pastTurns: JSON.parse(JSON.stringify(queueData.pastTurns)),
    lastAdvancedBy: queueData.lastAdvancedBy
  });

  if (queueData.history.length > 10) {
    queueData.history.shift();
  }

  // Los que estaban en turno pasan al historial de turnos previos con timestamp
  if (queueData.currentTurn.length > 0) {
    for (const u of queueData.currentTurn) {
      queueData.pastTurns.push({
        ...u,
        completedAt: Date.now()
      });
    }
    if (queueData.pastTurns.length > 10) {
      queueData.pastTurns = queueData.pastTurns.slice(-10);
    }
  }

  queueData.currentTurn = [];
  queueData.lastAdvancedBy = { id: user.id, username: user.username };

  const slots = queueData.slotsPerTurn || 1;
  while (queueData.currentTurn.length < slots && queueData.waitingList.length > 0) {
    const nextMember = queueData.waitingList.shift();
    nextMember.turnStartTime = Date.now();

    // Actualizar su apodo fresco si está disponible en el servidor
    if (guild && nextMember.id) {
      try {
        const mem = await guild.members.fetch(nextMember.id).catch(() => null);
        if (mem) {
          nextMember.displayName = mem.nickname || mem.displayName || nextMember.displayName || nextMember.username;
        }
      } catch {}
    }

    queueData.currentTurn.push(nextMember);
    notifyUserTurn(nextMember, queueData, channel, user);
  }
}

// Revierte el último avance (botón Atrás)
async function undoQueue(queueData, channel) {
  if (!queueData.history || queueData.history.length === 0) return false;

  const previousState = queueData.history.pop();
  const promotedNow = [...(queueData.currentTurn || [])];

  const prevWaitingIds = new Set(previousState.waitingListIds || []);
  const newlyJoinedUsers = (queueData.waitingList || []).filter(u => !prevWaitingIds.has(u.id));

  const restoredWaiting = [];
  for (const u of promotedNow) {
    restoredWaiting.push(u);
  }
  for (const u of (queueData.waitingList || [])) {
    if (!newlyJoinedUsers.some(nu => nu.id === u.id)) {
      restoredWaiting.push(u);
    }
  }
  for (const nu of newlyJoinedUsers) {
    if (!restoredWaiting.some(u => u.id === nu.id) && !previousState.currentTurn.some(u => u.id === nu.id)) {
      restoredWaiting.push(nu);
    }
  }

  queueData.currentTurn = previousState.currentTurn || [];
  queueData.waitingList = restoredWaiting;
  queueData.pastTurns = previousState.pastTurns || [];
  queueData.lastAdvancedBy = previousState.lastAdvancedBy || null;

  if (channel && typeof channel.send === 'function') {
    try {
      const undoMsg = await channel.send(`⏪ **Turno revertido:** Se ha restaurado la posición anterior en **${queueData.title}**.`);
      setTimeout(() => {
        undoMsg.delete().catch(() => {});
      }, 15000);
    } catch (e) {
      console.error('Error avisando reversión:', e);
    }
  }

  return true;
}

// Avisa en el canal con Ping Real + DM Privado + Auto-borrado en 10 minutos
async function notifyUserTurn(member, queueData, channel, advancedByUser) {
  const noteText = member.note ? ` (\`${member.note}\`)` : '';
  const advancedByText = advancedByUser ? ` *(avanzado por <@${advancedByUser.id}>)*` : '';

  if (channel && typeof channel.send === 'function') {
    try {
      const allowedUsers = [member.id];
      if (advancedByUser?.id) allowedUsers.push(advancedByUser.id);

      const pingMsg = await channel.send({
        content: `<@${member.id}>${noteText}, es tu turno en **${queueData.title}**${advancedByText}.`,
        allowedMentions: {
          users: allowedUsers
        }
      });

      setTimeout(() => {
        pingMsg.delete().catch(() => {});
      }, 10 * 60 * 1000);
    } catch (err) {
      console.error('Error enviando ping en canal:', err);
    }
  }

  // Notificación por DM privado
  try {
    const discordUser = await client.users.fetch(member.id).catch(() => null);
    if (discordUser) {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`¡Es tu turno en ${queueData.title}! 🔔`)
        .setDescription(`Has sido llamado a tu turno.${advancedByUser ? `\n**Avanzado por:** <@${advancedByUser.id}>` : ''}`)
        .setColor('#23A55A')
        .setTimestamp();

      await discordUser.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  } catch (err) {
    console.error('Error enviando DM al usuario:', err);
  }
}

// Iniciar sesión
client.login(process.env.DISCORD_TOKEN);
