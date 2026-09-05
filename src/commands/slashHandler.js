import { MessageFlags } from "discord.js";
import {
  queues,
  saveQueues,
  getQueuesInChannel,
} from "../storage/queueStore.js";
import { buildQueueEmbed } from "../ui/queueEmbed.js";
import {
  buildQueueButtons,
  buildCardViewerComponents,
} from "../ui/queueComponents.js";
import {
  resolveChannel,
  autoDeleteReply,
  cleanChannelExtraneousMessages,
  getMemberDisplayName,
} from "../utils/discordUtils.js";
import {
  advanceQueue,
  undoQueue,
  updateQueueMessage,
} from "../services/queueService.js";

/** Manejador principal para comandos Slash (/cola) */
export async function handleSlashCommand(interaction, client) {
  const { commandName, options } = interaction;
  if (commandName !== "cola") return;

  const channelId = interaction.channelId || interaction.channel?.id;
  const user = interaction.user;
  const subcommand = options.getSubcommand();

  // /cola crear
  if (subcommand === "crear") {
    const title = options.getString("titulo");
    const potionLevel = options.getInteger("nivel") || null;
    const description = options.getString("descripcion") || "";
    const maxCapacity = options.getInteger("limite") || 0;
    const slotsPerTurn = options.getInteger("por_turno") || 1;
    const iconUrl = options.getString("icono") || null;
    const bannerUrl = options.getString("banner") || null;
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
      messageId: null,
    };

    const embed = buildQueueEmbed(queueData);
    const components = buildQueueButtons(queueId, false);

    const message = await interaction.reply({
      embeds: [embed],
      components,
      fetchReply: true,
    });

    queueData.messageId = message.id;
    queues.set(queueId, queueData);
    saveQueues();
    return;
  }

  // /cola mostrar
  if (subcommand === "mostrar") {
    const targetQueueId = options.getString("cola");
    const queueData = queues.get(targetQueueId);

    if (!queueData) {
      return interaction.reply({
        content: "No se encontró la cola especificada.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const chan = await resolveChannel(
      client,
      queueData.channelId,
      interaction.channel,
    );
    if (chan && queueData.messageId) {
      try {
        const oldMsg = await chan.messages
          .fetch(queueData.messageId)
          .catch(() => null);
        if (oldMsg) await oldMsg.delete().catch(() => {});
      } catch {}
    }

    const embed = buildQueueEmbed(queueData);
    const components = buildQueueButtons(
      queueData.id,
      !!queueData.isClosed,
    );

    const newMsg = await interaction.reply({
      embeds: [embed],
      components,
      fetchReply: true,
    });

    queueData.messageId = newMsg.id;
    queueData.channelId = channelId;
    saveQueues();
    return;
  }

  // /cola editar
  if (subcommand === "editar") {
    const targetQueueId = options.getString("cola");
    const queueData = queues.get(targetQueueId);

    if (!queueData) {
      return interaction.reply({
        content: "No se encontró la cola especificada.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const newTitle = options.getString("titulo");
    const newLevel = options.getInteger("nivel");
    const newDesc = options.getString("descripcion");
    const newIcon = options.getString("icono");
    const newBanner = options.getString("banner");
    const newLimit = options.getInteger("limite");
    const newSlots = options.getInteger("por_turno");

    if (newTitle !== null) queueData.title = newTitle;
    if (newLevel !== null)
      queueData.potionLevel = newLevel === 0 ? null : newLevel;
    if (newDesc !== null) queueData.description = newDesc;
    if (newIcon !== null)
      queueData.iconUrl = newIcon.toLowerCase() === "quitar" ? null : newIcon;
    if (newBanner !== null)
      queueData.bannerUrl = newBanner.toLowerCase() === "quitar" ? null : newBanner;
    if (newLimit !== null) queueData.maxCapacity = newLimit;
    if (newSlots !== null) queueData.slotsPerTurn = newSlots;

    saveQueues();
    const chan = await resolveChannel(
      client,
      queueData.channelId,
      interaction.channel,
    );
    await updateQueueMessage(client, queueData, chan);

    const levelNotice =
      newLevel !== null
        ? newLevel > 0
          ? ` (Nivel asignado: Lv. ${newLevel})`
          : " (Nivel removido)"
        : "";
    return interaction.reply({
      content: ` Se actualizó la cola **${queueData.title}** exitosamente${levelNotice}.`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  // /cola tarjeta
  if (subcommand === "tarjeta") {
    const active = getQueuesInChannel(channelId);
    if (active.length === 0) {
      return interaction.reply({
        content: "No hay ninguna cola activa en este canal.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const firstIndex = 0;
    const currentQueue = active[firstIndex];
    const embed = buildQueueEmbed(currentQueue, {
      current: 1,
      total: active.length,
    });
    const components = buildCardViewerComponents(active, firstIndex);

    return interaction.reply({
      content: ` **Tarjeta interactiva de colas** (Cualquiera puede navegar con < y > o unirse):`,
      embeds: [embed],
      components,
    });
  }

  // /cola listar
  if (subcommand === "listar") {
    const active = getQueuesInChannel(channelId);
    if (active.length === 0) {
      return interaction.reply({
        content: "No hay ninguna cola activa en este canal.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const firstIndex = 0;
    const currentQueue = active[firstIndex];
    const embed = buildQueueEmbed(currentQueue, {
      current: 1,
      total: active.length,
    });
    const components = buildCardViewerComponents(active, firstIndex);

    return interaction.reply({
      content: ` **Tu visor privado de colas** (Solo tú lo ves):`,
      embeds: [embed],
      components,
      flags: [MessageFlags.Ephemeral],
    });
  }

  // /cola siguiente
  if (subcommand === "siguiente") {
    const targetQueueId = options.getString("cola");
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
          flags: [MessageFlags.Ephemeral],
        });
      }
    }

    if (!queueData) {
      return interaction.reply({
        content: "No se encontró la cola especificada.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const chan = await resolveChannel(client, channelId, interaction.channel);
    await advanceQueue(client, queueData, user, chan, interaction.guild);
    saveQueues();
    await updateQueueMessage(client, queueData, chan);
    return interaction.reply({
      content: `Turno avanzado en **${queueData.title}** por <@${user.id}>.`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  // /cola atras
  if (subcommand === "atras") {
    const targetQueueId = options.getString("cola");
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
          flags: [MessageFlags.Ephemeral],
        });
      }
    }

    if (!queueData) {
      return interaction.reply({
        content: "No se encontró la cola especificada.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const chan = await resolveChannel(client, channelId, interaction.channel);
    const reverted = await undoQueue(queueData, chan);
    if (!reverted) {
      return interaction.reply({
        content: `No hay turnos anteriores para revertir en **${queueData.title}**.`,
        flags: [MessageFlags.Ephemeral],
      });
    }
    saveQueues();
    await updateQueueMessage(client, queueData, chan);
    return interaction.reply({
      content: `Turno revertido en **${queueData.title}** por <@${user.id}>.`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  // /cola reset
  if (subcommand === "reset") {
    await interaction.deferReply();

    const allGuildQueues = Array.from(queues.values()).filter(
      (q) => !q.guildId || q.guildId === interaction.guildId,
    );
    const targetList =
      allGuildQueues.length > 0
        ? allGuildQueues
        : Array.from(queues.values());

    if (targetList.length === 0) {
      return interaction.editReply({
        content: "No hay ninguna cola registrada para reiniciar.",
      });
    }

    for (const q of targetList) {
      q.currentTurn = [];
      q.waitingList = [];
      q.pastTurns = [];
      q.history = [];
      q.lastAdvancedBy = null;
      q.isClosed = true;
    }
    saveQueues();

    await Promise.allSettled(
      targetList.map(async (q) => {
        try {
          const chan = await resolveChannel(
            client,
            q.channelId,
            interaction.channel,
          );
          if (chan) {
            await updateQueueMessage(client, q, chan);
          }
        } catch (err) {
          console.error(
            `Error al actualizar mensaje de cola ${q.title} en reset:`,
            err,
          );
        }
      }),
    );

    const replyPromise = interaction.editReply({
      content: ` **Reinicio Diario Completado:** Se han limpiado los turnos activos, la lista de espera y el historial de **todas las colas** (${targetList.length} en total). Han quedado cerradas y se abrirán automáticamente a las **18:00 (Chile)** o cuando uses \`/cola abrir\`.`,
    });
    autoDeleteReply(interaction, 12);
    return replyPromise;
  }

  // /cola abrir
  if (subcommand === "abrir") {
    await interaction.deferReply();
    const targetQueueId = options.getString("cola");
    let targetList = [];

    if (targetQueueId) {
      const q = queues.get(targetQueueId);
      if (q) targetList.push(q);
    } else {
      targetList = getQueuesInChannel(channelId);
    }

    if (targetList.length === 0) {
      const replyPromise = interaction.editReply({
        content: "No se encontraron colas para abrir en este canal.",
      });
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
          const chan = await resolveChannel(
            client,
            q.channelId,
            interaction.channel,
          );
          if (chan) {
            await updateQueueMessage(client, q, chan);
          }
        } catch (err) {
          console.error(`Error al abrir cola ${q.title}:`, err);
        }
      }),
    );

    const replyPromise = interaction.editReply({
      content: ` **Colas abiertas:** Se ha reanudado la recepción de participantes en ${targetList.length} cola(s). ¡Ya pueden unirse!`,
    });
    autoDeleteReply(interaction, 10);
    return replyPromise;
  }

  // /cola cerrar
  if (subcommand === "cerrar") {
    await interaction.deferReply();
    const targetQueueId = options.getString("cola");
    const shouldVaciar = options.getBoolean("vaciar") ?? true;
    let targetList = [];

    if (targetQueueId) {
      const q = queues.get(targetQueueId);
      if (q) targetList.push(q);
    } else {
      targetList = getQueuesInChannel(channelId);
      if (targetList.length === 0) {
        const allGuild = Array.from(queues.values()).filter(
          (q) => !q.guildId || q.guildId === interaction.guildId,
        );
        targetList =
          allGuild.length > 0 ? allGuild : Array.from(queues.values());
      }
    }

    if (targetList.length === 0) {
      const replyPromise = interaction.editReply({
        content: "No se encontraron colas para cerrar.",
      });
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
          const chan = await resolveChannel(
            client,
            q.channelId,
            interaction.channel,
          );
          if (chan) {
            await updateQueueMessage(client, q, chan);
          }
        } catch (err) {
          console.error(`Error al actualizar cola ${q.title}:`, err);
        }
      }),
    );

    const vaciarMsg = shouldVaciar
      ? " y se han **vaciado los turnos activos y la lista de espera**"
      : "";
    const replyPromise = interaction.editReply({
      content: `[CERRADA] **Colas cerradas:** Se ha pausado la recepción de participantes en **${targetList.length} cola(s)**${vaciarMsg}. Para reabrir usa \`/cola abrir\`.`,
    });
    autoDeleteReply(interaction, 10);
    return replyPromise;
  }

  // /cola vaciar
  if (subcommand === "vaciar") {
    await interaction.deferReply();
    const targetQueueId = options.getString("cola");
    let targetList = [];

    if (targetQueueId) {
      const q = queues.get(targetQueueId);
      if (q) targetList.push(q);
    } else {
      targetList = getQueuesInChannel(channelId);
      if (targetList.length === 0) {
        const allGuild = Array.from(queues.values()).filter(
          (q) => !q.guildId || q.guildId === interaction.guildId,
        );
        targetList =
          allGuild.length > 0 ? allGuild : Array.from(queues.values());
      }
    }

    if (targetList.length === 0) {
      const replyPromise = interaction.editReply({
        content: "No se encontraron colas para vaciar.",
      });
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
          const chan = await resolveChannel(
            client,
            q.channelId,
            interaction.channel,
          );
          if (chan) {
            await updateQueueMessage(client, q, chan);
          }
        } catch (err) {
          console.error(`Error al actualizar cola ${q.title}:`, err);
        }
      }),
    );

    const replyPromise = interaction.editReply({
      content: ` **Colas vaciadas:** Se han limpiado los turnos activos y la lista de espera de **${targetList.length} cola(s)**.`,
    });
    autoDeleteReply(interaction, 10);
    return replyPromise;
  }

  // /cola limpiar
  if (subcommand === "limpiar") {
    await interaction.deferReply();
    const chan = await resolveChannel(client, channelId, interaction.channel);
    const deletedCount = await cleanChannelExtraneousMessages(chan, 100);

    const replyPromise = interaction.editReply({
      content: ` **Canal limpiado:** Se han eliminado **${deletedCount}** mensaje(s) ajenos. Los paneles oficiales de las colas se mantienen intactos.`,
    });
    autoDeleteReply(interaction, 10);
    return replyPromise;
  }

  // /cola eliminar
  if (subcommand === "eliminar") {
    const targetQueueId = options.getString("cola");
    const queueData = queues.get(targetQueueId);

    if (!queueData) {
      return interaction.reply({
        content: "No se encontró la cola especificada.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const chan = await resolveChannel(
      client,
      queueData.channelId,
      interaction.channel,
    );
    if (chan && queueData.messageId) {
      try {
        const msg = await chan.messages
          .fetch(queueData.messageId)
          .catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      } catch {}
    }

    const queueTitle = queueData.title;
    queues.delete(targetQueueId);
    saveQueues();

    return interaction.reply({
      content: ` La cola **${queueTitle}** ha sido eliminada permanentemente.`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  // /cola mover
  if (subcommand === "mover") {
    const targetChannel = options.getChannel("canal");
    const targetQueueId = options.getString("cola");

    let queueData = null;
    if (targetQueueId) {
      queueData = queues.get(targetQueueId);
    } else {
      const channelQueues = getQueuesInChannel(channelId);
      if (channelQueues.length === 1) {
        queueData = channelQueues[0];
      } else if (channelQueues.length > 1) {
        return interaction.reply({
          content: `Hay ${channelQueues.length} colas en este canal. Especifica cuál deseas mover con la opción \`cola\`.`,
          flags: [MessageFlags.Ephemeral],
        });
      }
    }

    if (!queueData) {
      return interaction.reply({
        content: "No se encontró la cola especificada.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (queueData.channelId === targetChannel.id) {
      return interaction.reply({
        content: `La cola **${queueData.title}** ya se encuentra en el canal <#${targetChannel.id}>.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    const oldChannelId = queueData.channelId;

    // 1. Intentar borrar el mensaje/panel en el canal antiguo
    try {
      const oldChan = await resolveChannel(
        client,
        oldChannelId,
        interaction.channel,
      );
      if (oldChan && queueData.messageId) {
        const oldMsg =
          oldChan.messages.cache.get(queueData.messageId) ||
          (await oldChan.messages
            .fetch(queueData.messageId)
            .catch(() => null));
        if (oldMsg) {
          await oldMsg.delete().catch(() => null);
        }
      }
    } catch (err) {
      console.error(
        "Error borrando mensaje anterior en canal origen:",
        err.message,
      );
    }

    // 2. Publicar nuevo panel interactivo en el canal de destino
    let newMsg = null;
    try {
      const destChan = await resolveChannel(
        client,
        targetChannel.id,
        interaction.guild?.channels.cache.get(targetChannel.id),
      );
      if (!destChan) {
        return interaction.reply({
          content: `No se pudo acceder al canal de destino <#${targetChannel.id}>. Verifica los permisos del bot.`,
          flags: [MessageFlags.Ephemeral],
        });
      }

      const embed = buildQueueEmbed(queueData);
      const buttons = buildQueueButtons(queueData.id, queueData.isClosed);
      newMsg = await destChan.send({
        embeds: [embed],
        components: buttons,
      });
    } catch (err) {
      console.error(
        "Error publicando panel en canal destino:",
        err.message,
      );
      return interaction.reply({
        content: `Error al crear el panel en <#${targetChannel.id}>: ${err.message}`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    // 3. Actualizar la ubicación en la base de datos
    queueData.channelId = targetChannel.id;
    if (newMsg) {
      queueData.messageId = newMsg.id;
    }
    saveQueues();

    const replyPromise = interaction.reply({
      content: `La cola **${queueData.title}** ha sido trasladada con éxito al canal <#${targetChannel.id}> con todos sus participantes y turnos intactos.`,
    });
    autoDeleteReply(interaction, 15);
    return replyPromise;
  }

  // /cola insertar
  if (subcommand === "insertar") {
    const targetUser = options.getUser("usuario");
    const targetPos = options.getInteger("posicion");
    const note = options.getString("nota") || "";
    const targetQueueId = options.getString("cola");

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
          flags: [MessageFlags.Ephemeral],
        });
      }
    }

    if (!queueData) {
      return interaction.reply({
        content: "No se encontró la cola especificada.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (targetPos < 1) {
      return interaction.reply({
        content: "La posición debe ser 1 o superior.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const displayName = await getMemberDisplayName(
      interaction.guild,
      targetUser,
    );

    const participant = {
      id: targetUser.id,
      username: targetUser.username,
      displayName: displayName,
      joinedAt: Date.now(),
      turnStartTime: Date.now(),
      note: note,
    };

    if (!queueData.waitingList) queueData.waitingList = [];
    if (!queueData.currentTurn) queueData.currentTurn = [];

    queueData.waitingList = queueData.waitingList.filter(
      (u) => u.id !== targetUser.id,
    );
    queueData.currentTurn = queueData.currentTurn.filter(
      (u) => u.id !== targetUser.id,
    );

    const insertIndex = Math.min(
      targetPos - 1,
      queueData.waitingList.length,
    );
    queueData.waitingList.splice(insertIndex, 0, participant);

    saveQueues();
    const chan = await resolveChannel(client, channelId, interaction.channel);
    await updateQueueMessage(client, queueData, chan);

    const replyPromise = interaction.reply({
      content: ` <@${targetUser.id}> (${displayName}) ha sido insertado en la **Posición #${insertIndex + 1}** de la cola **${queueData.title}**${note ? ` con la nota: \`${note}\`` : ""}. Los participantes detrás han sido desplazados automáticamente.`,
    });
    autoDeleteReply(interaction, 12);
    return replyPromise;
  }
}
