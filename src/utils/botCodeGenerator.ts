export interface BotConfigOptions {
  botName: string;
  language: 'javascript' | 'typescript' | 'python';
  prefixOrSlash: 'slash' | 'prefix';
  slashCommandName: string;
  embedColor: string;
  includeModals: boolean;
  enableVoiceChannelAlert: boolean;
  enableDmNotification: boolean;
  allowHostOnlyAdvance: boolean;
}

export function generateDiscordJsCode(options: BotConfigOptions): string {
  const {
    slashCommandName = 'cola',
    embedColor = '#5865F2',
    includeModals = true,
    enableDmNotification = true,
    allowHostOnlyAdvance = true,
  } = options;

  return `/**
 * Bot de Discord - Lista de Espera / Cola Interactiva
 * Requisitos: Node.js 18+ y paquete 'discord.js' v14
 * Instalación: npm install discord.js dotenv
 * Ejecución: node bot.js
 */

const {
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
} = require('discord.js');
require('dotenv').config();

// Inicialización del cliente con intents mínimos necesarios
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

// Estructura en memoria para almacenar las colas activas por canal o mensaje
// Clave: ID del mensaje o ID del canal -> Datos de la cola
const queues = new Map();

// Definición de Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName('${slashCommandName}')
    .setDescription('Gestiona eventos con lista de espera / cola interactiva')
    .addSubcommand(sub =>
      sub
        .setName('crear')
        .setDescription('Crea un nuevo evento con cola y botones de acceso rápido')
        .addStringOption(opt =>
          opt.setName('titulo')
            .setDescription('Título del evento o propósito de la cola')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('descripcion')
            .setDescription('Instrucciones o detalles breves')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('limite')
            .setDescription('Capacidad máxima de participantes (0 para ilimitado)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('simultaneos')
            .setDescription('Cantidad de personas por turno (por defecto: 1)')
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
        .setDescription('Finaliza el evento y cierra la cola')
    )
].map(cmd => cmd.toJSON());

// Función auxiliar para construir el Embed interactivo de Discord
function buildQueueEmbed(queueData) {
  const { title, description, host, currentTurn, waitingList, maxCapacity, slotsPerTurn, createdAt } = queueData;
  const totalInQueue = currentTurn.length + waitingList.length;
  const capacityText = maxCapacity > 0 ? \`\${totalInQueue}/\${maxCapacity}\` : \`\${totalInQueue} personas\`;

  // Lista de turno actual
  let currentTurnText = '*(Nadie en turno actualmente)*';
  if (currentTurn.length > 0) {
    currentTurnText = currentTurn
      .map((u, i) => \`**\${i + 1}.** <@\${u.id}> \${u.note ? \`(\${u.note})\` : ''} 🌟\`)
      .join('\\n');
  }

  // Lista de espera (mostramos los primeros 10)
  let waitingListText = '*(La lista de espera está vacía. ¡Sé el primero en unirte!)*';
  if (waitingList.length > 0) {
    const preview = waitingList.slice(0, 10).map((u, i) => {
      const pos = i + 1;
      const noteStr = u.note ? \` - *"\${u.note}"*\` : '';
      return \`**#\${pos}** • <@\${u.id}>\${noteStr}\`;
    }).join('\\n');

    const remaining = waitingList.length - 10;
    waitingListText = remaining > 0 ? \`\${preview}\\n*... y \${remaining} más en espera*\` : preview;
  }

  const embed = new EmbedBuilder()
    .setTitle(\`🎟️ \${title}\`)
    .setDescription(description || 'Haz clic en los botones de abajo para unirte o gestionar tu turno.')
    .setColor('${embedColor}')
    .addFields(
      { name: '🌟 En Turno Actual', value: currentTurnText, inline: false },
      { name: \`📋 Lista de Espera (\${waitingList.length})\`, value: waitingListText, inline: false },
      { name: '👑 Creador / Host', value: \`<@\${host.id}>\`, inline: true },
      { name: '👥 Capacidad', value: capacityText, inline: true },
      { name: '⚡ Turno de a', value: \`\${slotsPerTurn} persona(s)\`, inline: true }
    )
    .setFooter({ text: 'Sistema de Colas Simple • Actualizado en tiempo real' })
    .setTimestamp(createdAt);

  return embed;
}

// Función auxiliar para los botones interactivos
function buildQueueButtons(isClosed = false) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_queue_join')
      .setLabel('🟢 Unirse a la Cola')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId('btn_queue_leave')
      .setLabel('🔴 Salir de la Cola')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId('btn_queue_status')
      .setLabel('🔍 Mi Posición')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isClosed)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_queue_next')
      .setLabel('⏭️ Siguiente en Turno')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId('btn_queue_close')
      .setLabel('🔒 Cerrar Cola')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isClosed)
  );

  return [row1, row2];
}

// Registro de Comandos Slash al Iniciar
client.once('ready', async () => {
  console.log(\`✅ Bot conectado como: \${client.user.tag}\`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('🔄 Registrando comandos Slash...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Comandos Slash registrados globalmente con éxito.');
  } catch (error) {
    console.error('Error registrando comandos:', error);
  }
});

// Manejo de Interacciones (Comandos Slash, Botones y Modales)
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      const { commandName, options, user, channel } = interaction;
      if (commandName === '${slashCommandName}') {
        const sub = options.getSubcommand();

        if (sub === 'crear') {
          const title = options.getString('titulo');
          const description = options.getString('descripcion') || '';
          const maxCapacity = options.getInteger('limite') || 0;
          const slotsPerTurn = options.getInteger('simultaneos') || 1;

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
            messageId: null,
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

        if (sub === 'siguiente') {
          // Buscar cola activa en este canal
          const queueEntry = Array.from(queues.values()).find(q => q.channelId === interaction.channelId);
          if (!queueEntry) {
            return interaction.reply({ content: '❌ No hay ninguna cola activa en este canal.', ephemeral: true });
          }

          ${allowHostOnlyAdvance ? `if (queueEntry.host.id !== user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '⛔ Solo el creador de la cola o moderadores pueden pasar el turno.', ephemeral: true });
          }` : ''}

          advanceQueue(queueEntry, interaction.channel);
          await interaction.reply({ content: '⏭️ Has avanzado el turno correctamente.', ephemeral: true });
          return;
        }

        if (sub === 'cerrar') {
          const queueEntry = Array.from(queues.values()).find(q => q.channelId === interaction.channelId);
          if (!queueEntry) {
            return interaction.reply({ content: '❌ No hay ninguna cola activa en este canal.', ephemeral: true });
          }

          ${allowHostOnlyAdvance ? `if (queueEntry.host.id !== user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '⛔ Solo el creador de la cola puede cerrarla.', ephemeral: true });
          }` : ''}

          await closeQueue(queueEntry, interaction.channel);
          await interaction.reply({ content: '🔒 La cola ha sido cerrada.', ephemeral: true });
          return;
        }
      }
    }

    // 2. BOTONES INTERACTIVOS
    if (interaction.isButton()) {
      const messageId = interaction.message.id;
      const queueData = queues.get(messageId);

      if (!queueData) {
        return interaction.reply({
          content: '⚠️ Esta cola ya no está activa en la memoria del bot.',
          ephemeral: true
        });
      }

      const { customId, user } = interaction;

      // UNIRSE A LA COLA
      if (customId === 'btn_queue_join') {
        const alreadyInTurn = queueData.currentTurn.some(u => u.id === user.id);
        const alreadyInWait = queueData.waitingList.some(u => u.id === user.id);

        if (alreadyInTurn) {
          return interaction.reply({ content: '🌟 ¡Ya estás en tu turno actualmente!', ephemeral: true });
        }
        if (alreadyInWait) {
          const pos = queueData.waitingList.findIndex(u => u.id === user.id) + 1;
          return interaction.reply({ content: \`ℹ️ Ya estás en la cola en la posición **#\${pos}**.\`, ephemeral: true });
        }

        if (queueData.maxCapacity > 0 && (queueData.currentTurn.length + queueData.waitingList.length) >= queueData.maxCapacity) {
          return interaction.reply({ content: '⛔ La cola ha alcanzado el límite máximo de participantes.', ephemeral: true });
        }

        ${includeModals ? `// Si quieres pedir un dato extra (ej. GamerTag, consulta o nota)
        const modal = new ModalBuilder()
          .setCustomId(\`modal_join_\${messageId}\`)
          .setTitle('Unirse a la Lista de Espera');

        const noteInput = new TextInputBuilder()
          .setCustomId('user_note')
          .setLabel('Nota o Identificador (Opcional)')
          .setPlaceholder('Ej: Gamertag / Motivo de consulta')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(50);

        modal.addComponents(new ActionRowBuilder().addComponents(noteInput));
        return await interaction.showModal(modal);` : `
        // Añadir directo sin modal
        queueData.waitingList.push({
          id: user.id,
          username: user.username,
          joinedAt: Date.now()
        });

        // Si no hay nadie en turno, asignar inmediatamente
        if (queueData.currentTurn.length < queueData.slotsPerTurn && queueData.waitingList.length > 0) {
          const nextUser = queueData.waitingList.shift();
          queueData.currentTurn.push(nextUser);
          notifyUserTurn(nextUser, interaction.channel);
        }

        await updateQueueMessage(queueData, interaction.channel);
        return interaction.reply({ content: '✅ ¡Te has unido a la lista de espera con éxito!', ephemeral: true });`}
      }

      // SALIR DE LA COLA
      if (customId === 'btn_queue_leave') {
        const waitIndex = queueData.waitingList.findIndex(u => u.id === user.id);
        const turnIndex = queueData.currentTurn.findIndex(u => u.id === user.id);

        if (waitIndex === -1 && turnIndex === -1) {
          return interaction.reply({ content: '❌ No estabas registrado en esta cola.', ephemeral: true });
        }

        if (waitIndex !== -1) {
          queueData.waitingList.splice(waitIndex, 1);
        }
        if (turnIndex !== -1) {
          queueData.currentTurn.splice(turnIndex, 1);
          // Si salió alguien de turno, pasar automáticamente al siguiente
          if (queueData.waitingList.length > 0) {
            const nextUser = queueData.waitingList.shift();
            queueData.currentTurn.push(nextUser);
            notifyUserTurn(nextUser, interaction.channel);
          }
        }

        await updateQueueMessage(queueData, interaction.channel);
        return interaction.reply({ content: '👋 Has salido de la lista de espera.', ephemeral: true });
      }

      // VER MI POSICIÓN
      if (customId === 'btn_queue_status') {
        const inTurn = queueData.currentTurn.some(u => u.id === user.id);
        if (inTurn) {
          return interaction.reply({ content: '🌟 ¡ES TU TURNO AHORA MISMO! Contacta al organizador.', ephemeral: true });
        }
        const pos = queueData.waitingList.findIndex(u => u.id === user.id);
        if (pos !== -1) {
          return interaction.reply({
            content: \`📍 Tu posición actual es la **#\${pos + 1}** en la lista de espera (hay \${pos} personas delante de ti).\`,
            ephemeral: true
          });
        }
        return interaction.reply({ content: '❌ No estás en la cola actualmente. Pulsa "Unirse a la Cola" para entrar.', ephemeral: true });
      }

      // SIGUIENTE EN TURNO (Host/Admin)
      if (customId === 'btn_queue_next') {
        ${allowHostOnlyAdvance ? `if (queueData.host.id !== user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ content: '⛔ Solo el organizador (<@' + queueData.host.id + '>) puede llamar al siguiente.', ephemeral: true });
        }` : ''}

        if (queueData.waitingList.length === 0 && queueData.currentTurn.length === 0) {
          return interaction.reply({ content: 'ℹ️ No hay nadie en la cola ni en espera.', ephemeral: true });
        }

        await interaction.deferUpdate();
        await advanceQueue(queueData, interaction.channel);
        return;
      }

      // CERRAR COLA
      if (customId === 'btn_queue_close') {
        ${allowHostOnlyAdvance ? `if (queueData.host.id !== user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ content: '⛔ Solo el creador de la cola puede cerrarla.', ephemeral: true });
        }` : ''}

        await interaction.deferUpdate();
        await closeQueue(queueData, interaction.channel);
        return;
      }
    }

    // 3. MODALES DE ENTRADA (CAPTURA DE NOTA)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_join_')) {
      const messageId = interaction.customId.replace('modal_join_', '');
      const queueData = queues.get(messageId);
      if (!queueData) {
        return interaction.reply({ content: '⚠️ La cola ya no existe.', ephemeral: true });
      }

      const note = interaction.fields.getTextInputValue('user_note') || '';
      const user = interaction.user;

      queueData.waitingList.push({
        id: user.id,
        username: user.username,
        note: note.trim(),
        joinedAt: Date.now()
      });

      // Si hay espacio libre en turno inmediato
      if (queueData.currentTurn.length < queueData.slotsPerTurn) {
        const nextUser = queueData.waitingList.shift();
        queueData.currentTurn.push(nextUser);
        notifyUserTurn(nextUser, interaction.channel);
      }

      await updateQueueMessage(queueData, interaction.channel);
      return interaction.reply({
        content: \`✅ ¡Te has unido a la cola! Posición: **#\${queueData.waitingList.length || 1}**\`,
        ephemeral: true
      });
    }

  } catch (err) {
    console.error('Error en interacción:', err);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: '⚠️ Ocurrió un error al procesar tu solicitud.', ephemeral: true });
    }
  }
});

// Función para avanzar la cola
async function advanceQueue(queueData, channel) {
  // Limpiar turno anterior
  queueData.currentTurn = [];

  // Llenar con los siguientes según slotsPerTurn
  while (queueData.currentTurn.length < queueData.slotsPerTurn && queueData.waitingList.length > 0) {
    const nextMember = queueData.waitingList.shift();
    queueData.currentTurn.push(nextMember);
    notifyUserTurn(nextMember, channel);
  }

  await updateQueueMessage(queueData, channel);
}

// Notificar al usuario por mención pública y opcional DM
async function notifyUserTurn(member, channel) {
  try {
    await channel.send({
      content: \`🔔 **¡ATENCIÓN!** <@\${member.id}>, es tu turno en **\${channel.name}**. ¡Prepárate!\`
    });

    ${enableDmNotification ? `// Enviar mensaje privado si tiene DMs abiertos
    const userObj = await client.users.fetch(member.id).catch(() => null);
    if (userObj) {
      userObj.send(\`🎉 **¡Es tu turno!** Ya puedes acceder a tu evento en el servidor.\`).catch(() => {});
    }` : ''}
  } catch (e) {
    console.error('Error notificando:', e);
  }
}

// Actualizar mensaje de la cola
async function updateQueueMessage(queueData, channel) {
  try {
    const msg = await channel.messages.fetch(queueData.messageId).catch(() => null);
    if (msg) {
      const embed = buildQueueEmbed(queueData);
      const components = buildQueueButtons(false);
      await msg.edit({ embeds: [embed], components });
    }
  } catch (err) {
    console.error('Error actualizando mensaje de cola:', err);
  }
}

// Cerrar cola
async function closeQueue(queueData, channel) {
  try {
    const msg = await channel.messages.fetch(queueData.messageId).catch(() => null);
    if (msg) {
      const embed = buildQueueEmbed(queueData);
      embed.setTitle(\`🔒 [CERRADA] \${queueData.title}\`);
      embed.setColor('#ED4245');
      const components = buildQueueButtons(true);
      await msg.edit({ embeds: [embed], components });
    }
    queues.delete(queueData.messageId);
    await channel.send('🛑 **La cola ha sido cerrada por el anfitrión.** ¡Gracias a todos por participar!');
  } catch (err) {
    console.error('Error cerrando cola:', err);
  }
}

client.login(process.env.DISCORD_TOKEN);
`;
}

export function generatePackageJson(botName: string = 'discord-queue-bot'): string {
  return JSON.stringify(
    {
      name: botName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: 'Bot de Discord simple para listas de espera y turnos con botones interactivos',
      main: 'bot.js',
      scripts: {
        start: 'node bot.js',
        dev: 'node --watch bot.js'
      },
      keywords: ['discord', 'queue', 'waiting-list', 'bot', 'discordjs'],
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
}

export function generateEnvExample(): string {
  return `# Token del bot de Discord (Obtenlo en https://discord.com/developers/applications)
DISCORD_TOKEN=TU_TOKEN_SECRETO_AQUI

# ID del Bot / Aplicación (Client ID en Developer Portal)
CLIENT_ID=123456789012345678

# Opcional: ID de tu Servidor de Discord para pruebas rápidas
GUILD_ID=123456789012345678
`;
}

export function generatePythonCode(options: BotConfigOptions): string {
  const { embedColor = '#5865F2' } = options;
  return `"""
Bot de Discord en Python - Cola y Lista de Espera con Botones
Requisitos: Python 3.10+ y 'discord.py'
Instalación: pip install discord.py python-dotenv
Ejecución: python bot.py
"""

import os
import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

intents = discord.Intents.default()
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)

# Almacenamiento de colas en memoria
queues = {}

class QueueView(discord.ui.View):
    def __init__(self, queue_id: str):
        super().__init__(timeout=None)
        self.queue_id = queue_id

    @discord.ui.button(label="🟢 Unirse a la Cola", style=discord.ButtonStyle.success, custom_id="join_btn")
    async def join_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        q = queues.get(self.queue_id)
        if not q:
            return await interaction.response.send_message("⚠️ Esta cola ya no está activa.", ephemeral=True)

        user = interaction.user
        if user.id in [u["id"] for u in q["turn"]] or user.id in [u["id"] for u in q["waiting"]]:
            return await interaction.response.send_message("ℹ️ Ya te encuentras registrado en esta cola.", ephemeral=True)

        if q["max"] > 0 and (len(q["turn"]) + len(q["waiting"])) >= q["max"]:
            return await interaction.response.send_message("⛔ La cola está llena.", ephemeral=True)

        # Si no hay nadie en turno, pasa directo
        if len(q["turn"]) < q["slots"]:
            q["turn"].append({"id": user.id, "name": user.display_name})
            await interaction.channel.send(f"🔔 **¡Es tu turno!** {user.mention}")
        else:
            q["waiting"].append({"id": user.id, "name": user.display_name})

        await self.update_embed(interaction)
        await interaction.response.send_message("✅ ¡Te has unido a la cola exitosamente!", ephemeral=True)

    @discord.ui.button(label="🔴 Salir", style=discord.ButtonStyle.secondary, custom_id="leave_btn")
    async def leave_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        q = queues.get(self.queue_id)
        if not q:
            return await interaction.response.send_message("⚠️ Cola inactiva.", ephemeral=True)

        user_id = interaction.user.id
        q["waiting"] = [u for u in q["waiting"] if u["id"] != user_id]
        was_in_turn = any(u["id"] == user_id for u in q["turn"])
        q["turn"] = [u for u in q["turn"] if u["id"] != user_id]

        if was_in_turn and q["waiting"]:
            next_user = q["waiting"].pop(0)
            q["turn"].append(next_user)
            await interaction.channel.send(f"🔔 **¡Es tu turno!** <@{next_user['id']}>")

        await self.update_embed(interaction)
        await interaction.response.send_message("👋 Has salido de la cola.", ephemeral=True)

    @discord.ui.button(label="⏭️ Siguiente (Host)", style=discord.ButtonStyle.primary, custom_id="next_btn")
    async def next_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        q = queues.get(self.queue_id)
        if not q:
            return await interaction.response.send_message("⚠️ Cola inactiva.", ephemeral=True)

        if interaction.user.id != q["host_id"]:
            return await interaction.response.send_message("⛔ Solo el creador de la cola puede avanzar el turno.", ephemeral=True)

        q["turn"] = []
        while len(q["turn"]) < q["slots"] and q["waiting"]:
            nxt = q["waiting"].pop(0)
            q["turn"].append(nxt)
            await interaction.channel.send(f"🔔 **¡Turno!** <@{nxt['id']}>")

        await self.update_embed(interaction)
        await interaction.response.send_message("⏭️ Turno avanzado.", ephemeral=True)

    async def update_embed(self, interaction: discord.Interaction):
        q = queues.get(self.queue_id)
        embed = build_embed(q)
        await interaction.message.edit(embed=embed, view=self)

def build_embed(q):
    turn_str = "\\n".join([f"**{i+1}.** <@{u['id']}> 🌟" for i, u in enumerate(q["turn"])]) or "*(Nadie en turno)*"
    wait_str = "\\n".join([f"**#{i+1}** <@{u['id']}>" for i, u in enumerate(q["waiting"][:10])]) or "*(Lista vacía)*"

    embed = discord.Embed(
        title=f"🎟️ {q['title']}",
        description=q['desc'] or "Usa los botones para unirte a la lista de espera.",
        color=0x5865F2
    )
    embed.add_field(name="🌟 En Turno", value=turn_str, inline=False)
    embed.add_field(name=f"📋 En Espera ({len(q['waiting'])})", value=wait_str, inline=False)
    embed.add_field(name="👑 Host", value=f"<@{q['host_id']}>", inline=True)
    return embed

@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"✅ Bot listo como {bot.user}")

@bot.tree.command(name="crear-cola", description="Crea una lista de espera interactiva")
@app_commands.describe(titulo="Nombre del evento", descripcion="Instrucciones")
async def crear_cola(interaction: discord.Interaction, titulo: str, descripcion: str = ""):
    queue_id = str(interaction.id)
    queues[queue_id] = {
        "title": titulo,
        "desc": descripcion,
        "host_id": interaction.user.id,
        "turn": [],
        "waiting": [],
        "max": 0,
        "slots": 1
    }
    embed = build_embed(queues[queue_id])
    view = QueueView(queue_id)
    await interaction.response.send_message(embed=embed, view=view)

bot.run(os.getenv("DISCORD_TOKEN"))
`;
}
