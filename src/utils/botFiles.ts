export interface BotFile {
  name: string;
  language: string;
  content: string;
  description: string;
  badge?: string;
}

export function getBotPackageFiles(options: {
  slashCommandName: string;
  embedColor: string;
  enableNotes: boolean;
  enableDm: boolean;
  hostOnlyAdvance: boolean;
}): BotFile[] {
  const {
    slashCommandName = 'cola',
    embedColor = '#5865F2',
    enableNotes = true,
    enableDm = true,
    hostOnlyAdvance = true,
  } = options;

  const botJs = `/**
 * ==============================================================================
 * DISCORD QUEUE BOT - LISTA DE ESPERA CON BOTONES INTERACTIVOS
 * ==============================================================================
 * Requisitos: Node.js 18+ y libreria 'discord.js' v14
 * 
 * 1. npm install
 * 2. Rellena el archivo .env con tu DISCORD_TOKEN
 * 3. node bot.js (o npm start)
 * ==============================================================================
 */

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} from 'discord.js';
import 'dotenv/config';

// Inicializamos el bot con los Intents basicos (No requiere privilegios especiales)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

// Memoria de colas activas (ID del Mensaje -> Datos del Evento)
const queues = new Map();

// Definicion del Comando Slash Principal
const slashCommands = [
  new SlashCommandBuilder()
    .setName('${slashCommandName}')
    .setDescription('Gestiona eventos con lista de espera y turnos')
    .addSubcommand(sub =>
      sub
        .setName('crear')
        .setDescription('Crea un nuevo evento con lista de espera y botones')
        .addStringOption(opt =>
          opt.setName('titulo')
            .setDescription('Nombre del evento o proposito de la cola')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('descripcion')
            .setDescription('Instrucciones, reglas o detalles para los participantes')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('limite')
            .setDescription('Capacidad maxima de personas (0 para ilimitado)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('por_turno')
            .setDescription('Cantidad de personas en turno simultaneo (defecto: 1)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('siguiente')
        .setDescription('Avanza al siguiente participante en la cola')
    )
    .addSubcommand(sub =>
      sub
        .setName('cerrar')
        .setDescription('Cierra y finaliza la cola activa en este canal')
    )
].map(cmd => cmd.toJSON());

// Helper para formatear timestamp nativo de Discord (<t:UNIX:t>)
function formatDiscordTimestamp(dateVal, style = 't') {
  if (!dateVal) return '';
  const ms = typeof dateVal === 'number' ? dateVal : new Date(dateVal).getTime();
  if (isNaN(ms) || ms <= 0) return '';
  const unix = Math.floor(ms / 1000);
  return \`<t:\${unix}:\${style}>\`;
}

// Construye el Embed visual para Discord con formato de hora regional interactiva
function buildQueueEmbed(queueData) {
  const { title, description, host, currentTurn, waitingList, maxCapacity, slotsPerTurn, createdAt, lastAdvancedBy, pastTurns, isClosed } = queueData;
  const currList = currentTurn || [];
  const waitList = waitingList || [];
  const totalCount = currList.length + waitList.length;
  const capacityStr = maxCapacity > 0 ? \`\${totalCount}/\${maxCapacity}\` : \`\${totalCount}\`;

  // 1. Quien esta en turno actual (Hora regional dinamica con tooltip)
  let currentTurnText = '*(Nadie en turno)*';
  if (currList.length > 0) {
    const lines = currList.map(u => {
      const timeTag = formatDiscordTimestamp(u.turnStartTime || u.joinedAt);
      const timeStr = timeTag ? \` (\${timeTag})\` : '';
      const noteStr = u.note ? \` [\${u.note}]\` : '';
      return \`> 🟢 **@\${u.displayName || u.username || u.id}**\${noteStr}\${timeStr}\`;
    });
    currentTurnText = lines.join('\\n');
  }

  // 2. Lista de espera (Hora regional dinamica con tooltip)
  let waitingListText = '*(Vacia)*';
  if (waitList.length > 0) {
    const lines = [];
    let totalChars = 0;
    let truncatedCount = 0;

    for (let i = 0; i < waitList.length; i++) {
      const u = waitList[i];
      const noteStr = u.note ? \` [\${u.note}]\` : '';
      const numStr = String(i + 1).padStart(2, '0');
      const timeTag = formatDiscordTimestamp(u.joinedAt);
      const timeStr = timeTag ? \` (\${timeTag})\` : '';
      const line = \`**\${numStr}.** @\${u.displayName || u.username || u.id}\${noteStr}\${timeStr}\`;
      if (totalChars + line.length > 900 || lines.length >= 10) {
        truncatedCount = waitList.length - i;
        break;
      }
      lines.push(line);
      totalChars += line.length + 1;
    }
    if (truncatedCount > 0) {
      lines.push(\`*... (+\${truncatedCount} mas en fila)*\`);
    }
    waitingListText = lines.join('\\n');
  }

  // 3. Turnos pasados (Hora regional dinamica con tooltip)
  let pastText = '*(Sin turnos previos)*';
  if (pastTurns && pastTurns.length > 0) {
    const recent = pastTurns.slice(-8).reverse();
    const lines = recent.map(u => {
      const timeTag = formatDiscordTimestamp(u.completedAt || u.turnStartTime || u.joinedAt);
      const timeStr = timeTag ? \` (\${timeTag})\` : '';
      const noteStr = u.note ? \` [\${u.note}]\` : '';
      return \`• @\${u.displayName || u.username || u.id}\${noteStr}\${timeStr}\`;
    });
    pastText = lines.join('\\n');
  }

  const embed = new EmbedBuilder()
    .setTitle(\`\${title || 'Cola de Turnos'} \${isClosed ? '🔒' : ''}\`)
    .setColor(isClosed ? '#ED4245' : '#2B2D31')
    .addFields(
      { name: 'EN TURNO', value: currentTurnText, inline: false },
      { name: \`EN COLA (\${waitList.length})\`, value: waitingListText, inline: true },
      { name: \`TURNOS PASADOS (\${pastTurns?.length ? Math.min(pastTurns.length, 8) : 0})\`, value: pastText, inline: true }
    );

  const advancePart = lastAdvancedBy ? \`Ultimo avance por: @\${lastAdvancedBy.username}\` : \`Estado: \${isClosed ? '🔒 CERRADA' : '🟢 ABIERTA'}\`;
  const totalPart = \`Total anotados: \${capacityStr}\`;
  const hostPart = host ? \`Organizador: @\${host.username || host}\` : '';
  embed.setFooter({ text: \`\${advancePart}  •  \${totalPart}  •  \${hostPart}\` });

  let desc = description || '';
  if (isClosed) {
    desc = \`*🔒 Cola cerrada temporalmente (Abre a las 18:00 hrs Chile o con /cola abrir).* \\n\${desc}\`.trim();
  } else if (desc.trim().length > 0) {
    desc = \`*\${desc}*\`;
  }

  if (desc.trim().length > 0) {
    embed.setDescription(desc);
  }

  return embed;
}

// Genera los botones interactivos en una sola fila limpia de 5 botones
function buildQueueButtons(isClosed = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_queue_join')
      .setLabel('Unirse')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId('btn_queue_leave')
      .setLabel('Salir')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId('btn_queue_next')
      .setLabel('Siguiente')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId('btn_queue_undo')
      .setLabel('Atras')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed)
  );

  return [row];
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

// Al encender el bot: Registrar comandos Slash en Discord
client.once('clientReady', async () => {
  console.log(\`==============================================\`);
  console.log(\`✅ Bot ONLINE y conectado como: \${client.user.tag}\`);
  console.log(\`==============================================\`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('🔄 Registrando comandos Slash (/${slashCommandName})...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: slashCommands }
    );
    console.log('✅ Comandos Slash registrados con exito en Discord.');
  } catch (err) {
    console.error('❌ Error registrando comandos Slash:', err);
  }
});

// Controlador de Interacciones (Comandos Slash, Botones y Modales)
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. MANEJO DE COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      const { commandName, options, user, channel } = interaction;

      if (commandName === '${slashCommandName}') {
        const subcommand = options.getSubcommand();

        // /cola crear
        if (subcommand === 'crear') {
          const title = options.getString('titulo');
          const description = options.getString('descripcion') || '';
          const maxCapacity = options.getInteger('limite') || 0;
          const slotsPerTurn = options.getInteger('por_turno') || 1;

          const queueData = {
            id: \`queue_\${Date.now()}\`,
            title,
            description,
            host: { id: user.id, username: user.username },
            maxCapacity,
            slotsPerTurn,
            createdAt: new Date(),
            currentTurn: [],
            waitingList: [],
            channelId: channel.id,
            messageId: null
          };

          const embed = buildQueueEmbed(queueData);
          const components = buildQueueButtons(false);

          const message = await interaction.reply({
            embeds: [embed],
            components,
            fetchReply: true
          });

          queueData.messageId = message.id;
          queues.set(message.id, queueData);
          return;
        }

        // /cola siguiente
        if (subcommand === 'siguiente') {
          const queueData = Array.from(queues.values()).find(q => q.channelId === interaction.channelId);
          if (!queueData) {
            return interaction.reply({ content: '❌ No hay ninguna cola activa en este canal.', ephemeral: true });
          }

          ${hostOnlyAdvance ? `if (queueData.host.id !== user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '⛔ Solo el creador del evento o moderadores pueden avanzar el turno.', ephemeral: true });
          }` : ''}

          await advanceQueue(queueData, interaction.channel);
          return interaction.reply({ content: '⏭️ Has avanzado el turno.', ephemeral: true });
        }

        // /cola cerrar
        if (subcommand === 'cerrar') {
          const queueData = Array.from(queues.values()).find(q => q.channelId === interaction.channelId);
          if (!queueData) {
            return interaction.reply({ content: '❌ No hay ninguna cola activa en este canal.', ephemeral: true });
          }

          ${hostOnlyAdvance ? `if (queueData.host.id !== user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '⛔ Solo el anfitrion puede cerrar la cola.', ephemeral: true });
          }` : ''}

          await closeQueue(queueData, interaction.channel);
          return interaction.reply({ content: '🔒 La cola ha sido cerrada.', ephemeral: true });
        }
      }
    }

    // 2. MANEJO DE CLICKS EN BOTONES
    if (interaction.isButton()) {
      const messageId = interaction.message.id;
      const queueData = queues.get(messageId);

      if (!queueData) {
        return interaction.reply({
          content: '⚠️ Este evento ya no esta activo en la memoria del bot.',
          ephemeral: true
        });
      }

      const { customId, user } = interaction;

      // BOTON: UNIRSE A LA COLA
      if (customId === 'btn_queue_join') {
        const inTurn = queueData.currentTurn.some(u => u.id === user.id);
        const inWait = queueData.waitingList.some(u => u.id === user.id);

        if (inTurn) {
          return interaction.reply({ content: '🌟 ¡Ya es tu turno actualmente!', ephemeral: true });
        }
        if (inWait) {
          const pos = queueData.waitingList.findIndex(u => u.id === user.id) + 1;
          return interaction.reply({ content: \`ℹ️ Ya estas en la cola en la posicion **#\${pos}**.\`, ephemeral: true });
        }
        if (queueData.maxCapacity > 0 && (queueData.currentTurn.length + queueData.waitingList.length) >= queueData.maxCapacity) {
          return interaction.reply({ content: '⛔ La cola ha alcanzado el limite maximo de participantes.', ephemeral: true });
        }

        ${enableNotes ? `// Modal para pedir nota / tag
        const modal = new ModalBuilder()
          .setCustomId(\`modal_join_\${messageId}\`)
          .setTitle('Unirse a la Lista de Espera');

        const input = new TextInputBuilder()
          .setCustomId('user_note')
          .setLabel('GamerTag / Nota / Consulta (Opcional)')
          .setPlaceholder('Ej: RiotID / Cuenta / Breve duda')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(50);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);` : `
        queueData.waitingList.push({
          id: user.id,
          username: user.username,
          joinedAt: Date.now()
        });

        if (queueData.currentTurn.length < queueData.slotsPerTurn && queueData.waitingList.length > 0) {
          const next = queueData.waitingList.shift();
          queueData.currentTurn.push(next);
          notifyUserTurn(next, interaction.channel);
        }

        await updateQueueMessage(queueData, interaction.channel);
        return interaction.reply({ content: '✅ ¡Te has unido a la cola exitosamente!', ephemeral: true });`}
      }

      // BOTON: SALIR DE LA COLA
      if (customId === 'btn_queue_leave') {
        const waitIndex = queueData.waitingList.findIndex(u => u.id === user.id);
        const turnIndex = queueData.currentTurn.findIndex(u => u.id === user.id);

        if (waitIndex === -1 && turnIndex === -1) {
          return interaction.reply({ content: '❌ No estas en la cola.', ephemeral: true });
        }

        if (waitIndex !== -1) queueData.waitingList.splice(waitIndex, 1);
        if (turnIndex !== -1) {
          queueData.currentTurn.splice(turnIndex, 1);
          if (queueData.waitingList.length > 0) {
            const next = queueData.waitingList.shift();
            queueData.currentTurn.push(next);
            notifyUserTurn(next, interaction.channel);
          }
        }

        await updateQueueMessage(queueData, interaction.channel);
        return interaction.reply({ content: '👋 Has salido de la lista de espera.', ephemeral: true });
      }

      // BOTON: MI POSICION
      if (customId === 'btn_queue_status') {
        const inTurn = queueData.currentTurn.some(u => u.id === user.id);
        if (inTurn) {
          return interaction.reply({ content: '🌟 ¡ES TU TURNO AHORA MISMO! Contacta al organizador.', ephemeral: true });
        }

        const pos = queueData.waitingList.findIndex(u => u.id === user.id);
        if (pos !== -1) {
          return interaction.reply({
            content: \`📍 Tu posicion actual es la **#\${pos + 1}** en espera (hay \${pos} personas antes de ti).\`,
            ephemeral: true
          });
        }

        return interaction.reply({ content: '❌ No estas registrado en esta cola. Pulsa "🟢 Unirse a la Cola" para entrar.', ephemeral: true });
      }

      // BOTON: SIGUIENTE EN TURNO (HOST)
      if (customId === 'btn_queue_next') {
        ${hostOnlyAdvance ? `if (queueData.host.id !== user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ content: '⛔ Solo el organizador (<@' + queueData.host.id + '>) puede llamar al siguiente.', ephemeral: true });
        }` : ''}

        if (queueData.waitingList.length === 0 && queueData.currentTurn.length === 0) {
          return interaction.reply({ content: 'ℹ️ No hay nadie en espera.', ephemeral: true });
        }

        await interaction.deferUpdate();
        await advanceQueue(queueData, interaction.channel);
        return;
      }

      // BOTON: CERRAR COLA (HOST)
      if (customId === 'btn_queue_close') {
        ${hostOnlyAdvance ? `if (queueData.host.id !== user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ content: '⛔ Solo el organizador puede cerrar la cola.', ephemeral: true });
        }` : ''}

        await interaction.deferUpdate();
        await closeQueue(queueData, interaction.channel);
        return;
      }
    }

    // 3. MANEJO DE MODAL (CUANDO ESCRIBEN NOTA)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_join_')) {
      const messageId = interaction.customId.replace('modal_join_', '');
      const queueData = queues.get(messageId);
      if (!queueData) {
        return interaction.reply({ content: '⚠️ La cola ya no esta disponible.', ephemeral: true });
      }

      const note = interaction.fields.getTextInputValue('user_note') || '';
      const user = interaction.user;

      queueData.waitingList.push({
        id: user.id,
        username: user.username,
        note: note.trim(),
        joinedAt: Date.now()
      });

      if (queueData.currentTurn.length < queueData.slotsPerTurn) {
        const next = queueData.waitingList.shift();
        queueData.currentTurn.push(next);
        notifyUserTurn(next, interaction.channel);
      }

      await updateQueueMessage(queueData, interaction.channel);
      return interaction.reply({
        content: \`✅ ¡Te has unido a la cola! Posicion: **#\${queueData.waitingList.length || 1}**\`,
        ephemeral: true
      });
    }

  } catch (error) {
    console.error('Error en interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: '⚠️ Ocurrio un error al procesar tu solicitud.', ephemeral: true });
    }
  }
});

// Avanza la cola al siguiente cupo
async function advanceQueue(queueData, channel) {
  queueData.currentTurn = [];
  while (queueData.currentTurn.length < queueData.slotsPerTurn && queueData.waitingList.length > 0) {
    const nextMember = queueData.waitingList.shift();
    queueData.currentTurn.push(nextMember);
    notifyUserTurn(nextMember, channel);
  }
  await updateQueueMessage(queueData, channel);
}

// Notifica al usuario en el canal con etiqueta @
async function notifyUserTurn(member, channel) {
  try {
    await channel.send({
      content: \`🔔 **¡ES TU TURNO!** <@\${member.id}> \${member.note ? \`(\${member.note})\` : ''}, ya puedes ingresar.\`
    });

    ${enableDm ? `// Notificacion por Mensaje Directo (DM)
    const userObj = await client.users.fetch(member.id).catch(() => null);
    if (userObj) {
      userObj.send(\`🎉 **¡Es tu turno en \${channel.guild.name}!** Accede al canal **#\${channel.name}**.\`).catch(() => {});
    }` : ''}
  } catch (err) {
    console.error('Error notificando:', err);
  }
}

// Actualiza el Embed en Discord
async function updateQueueMessage(queueData, channel) {
  try {
    const msg = await channel.messages.fetch(queueData.messageId).catch(() => null);
    if (msg) {
      const embed = buildQueueEmbed(queueData);
      const components = buildQueueButtons(false);
      await msg.edit({ embeds: [embed], components });
    }
  } catch (err) {
    console.error('Error actualizando embed:', err);
  }
}

// Cierra la cola
async function closeQueue(queueData, channel) {
  try {
    const msg = await channel.messages.fetch(queueData.messageId).catch(() => null);
    if (msg) {
      const embed = buildQueueEmbed(queueData);
      embed.setTitle(\`🔒 [FINALIZADA] \${queueData.title}\`);
      embed.setColor('#ED4245');
      const components = buildQueueButtons(true);
      await msg.edit({ embeds: [embed], components });
    }
    queues.delete(queueData.messageId);
    await channel.send('🛑 **La cola ha sido cerrada.** ¡Gracias a todos los participantes!');
  } catch (err) {
    console.error('Error cerrando cola:', err);
  }
}

client.login(process.env.DISCORD_TOKEN);
`;

  const packageJson = JSON.stringify(
    {
      name: 'discord-queue-bot',
      version: '1.0.0',
      description: 'Bot simple para Discord de lista de espera con botones y turnos',
      type: 'module',
      main: 'bot.js',
      scripts: {
        start: 'node bot.js',
        dev: 'node --watch bot.js'
      },
      dependencies: {
        'discord.js': '^14.16.3',
        dotenv: '^16.4.5'
      },
      engines: {
        node: '>=18.0.0'
      }
    },
    null,
    2
  );

  const envFile = `# ====================================================================
# ARCHIVO DE CONFIGURACION (.env)
# ====================================================================
# 1. Ve a https://discord.com/developers/applications
# 2. Selecciona tu Bot -> seccion 'Bot' -> 'Reset Token'
# 3. Pega tu Token aqui abajo:

DISCORD_TOKEN=TU_TOKEN_AQUI_SIN_ESPACIOS
`;

  const discloudConfig = `# ====================================================================
# CONFIGURACION PARA DISCLOUD (HOSTING 24/7 GRATUITO)
# ====================================================================
NAME=QueueBot
TYPE=bot
MAIN=bot.js
RAM=100
AUTORESTART=true
VERSION=latest
APT=tools
`;

  const gitignoreFile = `# Ignorar dependencias
node_modules/

# NUNCA subir el token a GitHub
.env
*.env.local

# Logs
*.log
npm-debug.log*

# Sistema operativo
.DS_Store
Thumbs.db
`;

  const readmeMd = `# Manual de Uso: Bot de Colas para Discord

Guía directa de comandos y funciones del bot.

---

## 1. Botones del Panel de Cola

Los usuarios interactúan directamente con los botones en el mensaje de la cola:

* **Unirse:** Ingresa a la cola. Si hay cupos disponibles, pasa de inmediato a "EN TURNO". De lo contrario, queda en "EN COLA".
* **Salir:** Retira al usuario de la lista de espera o del turno activo.
* **Siguiente:** Finaliza el turno actual y avanza a los siguientes participantes en espera.
* **Atras:** Revierte el último turno si se avanzó por error.

---

## 2. Comandos Slash (\`/cola\`)

### Creación y Visualización

* \`/cola crear\`
  * Parámetros: \`titulo\` (obligatorio), \`descripcion\`, \`limite\`, \`por_turno\`, \`icono\`, \`banner\`.
  * Función: Crea una nueva cola en el canal actual y publica el panel interactivo.

* \`/cola mostrar\`
  * Parámetros: \`cola\` (obligatorio).
  * Función: Vuelve a publicar el panel de una cola al final del chat para que quede visible.

* \`/cola tarjeta\`
  * Función: Publica una tarjeta interactiva navegable para consultar todas las colas del canal.

* \`/cola listar\`
  * Función: Muestra un menú privado e individual con el estado de las colas.

---

### Gestión de Turnos

* \`/cola siguiente\`
  * Parámetros: \`cola\` (opcional).
  * Función: Hace avanzar el turno de la cola indicada o de la única activa en el canal.

* \`/cola atras\`
  * Parámetros: \`cola\` (opcional).
  * Función: Revierte el último avance y restaura a los usuarios previos.

* \`/cola insertar\`
  * Parámetros: \`usuario\` (obligatorio), \`posicion\` (obligatorio), \`cola\` (opcional), \`nota\` (opcional).
  * Función: Coloca a un usuario en una posición específica de la fila (ej: posición 1) y desplaza al resto hacia atrás.

---

### Control, Estado y Limpieza

* \`/cola abrir\`
  * Parámetros: \`cola\` (opcional).
  * Función: Abre la recepción de participantes en una cola específica o en todas las del canal.

* \`/cola cerrar\`
  * Parámetros: \`cola\` (opcional), \`vaciar\` (opcional, Sí por defecto).
  * Función: Cierra la cola para impedir nuevos ingresos y, por defecto, vacía los turnos y la lista de espera.

* \`/cola vaciar\`
  * Parámetros: \`cola\` (opcional).
  * Función: Borra los turnos activos y la lista de espera sin cerrar la cola.

* \`/cola reset\`
  * Función: Limpia turnos activos, listas de espera e historial de todas las colas, dejándolas cerradas para el siguiente ciclo.

* \`/cola limpiar\`
  * Función: Borra los mensajes de texto enviados por usuarios en el canal para mantener el chat despejado. No borra los paneles de cola ni mensajes anclados.

* \`/cola editar\`
  * Parámetros: \`cola\` (obligatorio), \`titulo\`, \`descripcion\`, \`limite\`, \`por_turno\`, \`icono\`, \`banner\`.
  * Función: Modifica la configuración de una cola existente. Para quitar icono o banner, escribe la palabra "quitar".

* \`/cola eliminar\`
  * Parámetros: \`cola\` (obligatorio).
  * Función: Elimina la cola de forma permanente y borra su panel del canal.

---

## 3. Automatización de Horarios

* **Apertura automática:** Todos los días a las 18:00 (Hora de Chile / America/Santiago), el bot abre automáticamente todas las colas activas del servidor.
* **Auto-eliminación de avisos:** Las confirmaciones de comandos se borran automáticamente a los 10 segundos para no ensuciar el canal.
`;

  return [
    {
      name: 'bot.js',
      language: 'javascript',
      content: botJs,
      description: 'Código fuente principal del bot en Node.js (Discord.js v14)',
      badge: 'Principal'
    },
    {
      name: 'package.json',
      language: 'json',
      content: packageJson,
      description: 'Dependencias del proyecto listas para "npm install"',
    },
    {
      name: '.env',
      language: 'shell',
      content: envFile,
      description: 'Variables de entorno donde colocas el token de tu bot',
    },
    {
      name: '.gitignore',
      language: 'shell',
      content: gitignoreFile,
      description: 'Protege tu token para que nunca se suba a GitHub accidentalmente',
      badge: 'Git & GitHub'
    },
    {
      name: 'discloud.config',
      language: 'shell',
      content: discloudConfig,
      description: 'Configuración para subir a Discloud y dejarlo 24/7 en 1 clic',
      badge: '24/7 Hosting'
    },
    {
      name: 'README.md',
      language: 'markdown',
      content: readmeMd,
      description: 'Guía de instalación y comandos',
    },
  ];
}
