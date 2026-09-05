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
  buildLevelSelectMenu,
} from "../ui/queueComponents.js";
import {
  resolveChannel,
  getMemberDisplayName,
} from "../utils/discordUtils.js";
import {
  advanceQueue,
  undoQueue,
  updateQueueMessage,
  notifyUserTurn,
} from "../services/queueService.js";

/** Manejador de botones interactivos de las colas y tarjetas */
export async function handleButtonInteraction(interaction, client) {
  const customId = interaction.customId;
  const channelId = interaction.channelId || interaction.channel?.id;
  const user = interaction.user;

  // Botón para abrir el menú de selección de nivel de poción
  if (customId.startsWith("btn_setlvl_menu:")) {
    const queueId = customId.split(":")[1];
    const queueData = queues.get(queueId);

    if (!queueData) {
      return interaction.reply({
        content: "Cola no encontrada.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const levelSelectRow = buildLevelSelectMenu(queueData);
    return interaction.reply({
      content: ` **Configurar Nivel para "${queueData.title}":**\nSelecciona el nivel correspondiente para asignar color temático y badge automático:`,
      components: [levelSelectRow],
      flags: [MessageFlags.Ephemeral],
    });
  }

  // Navegación entre tarjetas (<, >, |<, >|)
  if (customId.startsWith("card_nav:")) {
    const [, direction, currentIndexStr] = customId.split(":");
    const currentIndex = parseInt(currentIndexStr, 10) || 0;
    const active = getQueuesInChannel(channelId);

    if (active.length === 0) {
      return interaction.update({
        content: "No hay colas activas en este canal.",
        embeds: [],
        components: [],
      });
    }

    let newIndex = currentIndex;
    if (direction === "prev") newIndex = Math.max(0, currentIndex - 1);
    if (direction === "next")
      newIndex = Math.min(active.length - 1, currentIndex + 1);
    if (direction === "first") newIndex = 0;
    if (direction === "last") newIndex = active.length - 1;

    const currentQueue = active[newIndex];
    const embed = buildQueueEmbed(currentQueue, {
      current: newIndex + 1,
      total: active.length,
    });
    const components = buildCardViewerComponents(active, newIndex);

    return interaction.update({ embeds: [embed], components });
  }

  // Botón para ocultar la tarjeta de colas
  if (customId.startsWith("btn_hide:")) {
    return interaction.message.delete().catch(() => {
      interaction.reply({
        content: "Tarjeta oculta.",
        flags: [MessageFlags.Ephemeral],
      });
    });
  }

  const [action, queueId] = customId.split(":");
  const queueData = queues.get(queueId);

  if (!queueData) {
    return interaction.reply({
      content: "Esta cola ya no existe o fue finalizada.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  const chan = await resolveChannel(
    client,
    queueData.channelId,
    interaction.channel,
  );

  // Acción: Unirse a la cola
  if (action === "btn_join") {
    if (queueData.isClosed) {
      return interaction.reply({
        content: `[CERRADA] La cola **${queueData.title}** está cerrada temporalmente. Se reanudará automáticamente a las 18:00 (Chile) o cuando un moderador use \`/cola abrir\`.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    const inTurn = (queueData.currentTurn || []).some((u) => u.id === user.id);
    const inWait = (queueData.waitingList || []).some((u) => u.id === user.id);

    if (inTurn) {
      return interaction.reply({
        content: `Ya estás en tu turno actualmente en **${queueData.title}**.`,
        flags: [MessageFlags.Ephemeral],
      });
    }
    if (inWait) {
      const pos =
        queueData.waitingList.findIndex((u) => u.id === user.id) + 1;
      return interaction.reply({
        content: `Ya estás en la cola **${queueData.title}** en la posición #${pos}.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    const totalIn =
      (queueData.currentTurn?.length || 0) +
      (queueData.waitingList?.length || 0);
    if (queueData.maxCapacity > 0 && totalIn >= queueData.maxCapacity) {
      return interaction.reply({
        content: `La cola **${queueData.title}** ha alcanzado su límite máximo de cupos.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    const memberName = await getMemberDisplayName(
      interaction.guild,
      user,
      interaction.member,
    );
    const participant = {
      id: user.id,
      username: user.username,
      displayName: memberName,
      joinedAt: Date.now(),
      turnStartTime: Date.now(),
      note: "",
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
      await updateQueueMessage(client, queueData, chan);
    }

    if (interaction.message.components?.length === 3) {
      const active = getQueuesInChannel(channelId);
      const currentIndex = active.findIndex((q) => q.id === queueData.id);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const embed = buildQueueEmbed(queueData, {
        current: safeIndex + 1,
        total: active.length,
      });
      const components = buildCardViewerComponents(active, safeIndex);
      await interaction.update({ embeds: [embed], components });
    } else {
      const updatedEmbed = buildQueueEmbed(queueData);
      const components = buildQueueButtons(
        queueData.id,
        !!queueData.isClosed,
      );
      await interaction.update({ embeds: [updatedEmbed], components });
    }
    return;
  }

  // Acción: Salir de la cola
  if (action === "btn_leave") {
    const waitIndex = (queueData.waitingList || []).findIndex(
      (u) => u.id === user.id,
    );
    const turnIndex = (queueData.currentTurn || []).findIndex(
      (u) => u.id === user.id,
    );

    if (waitIndex === -1 && turnIndex === -1) {
      return interaction.reply({
        content: `No estás anotado en **${queueData.title}**.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (waitIndex !== -1) queueData.waitingList.splice(waitIndex, 1);
    if (turnIndex !== -1) {
      queueData.currentTurn.splice(turnIndex, 1);
      if (queueData.waitingList && queueData.waitingList.length > 0) {
        const next = queueData.waitingList.shift();
        next.turnStartTime = Date.now();
        queueData.currentTurn.push(next);
        notifyUserTurn(client, next, queueData, chan, null);
      }
    }

    saveQueues();
    if (interaction.message.id !== queueData.messageId) {
      await updateQueueMessage(client, queueData, chan);
    }

    if (interaction.message.components?.length === 3) {
      const active = getQueuesInChannel(channelId);
      const currentIndex = active.findIndex((q) => q.id === queueData.id);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const embed = buildQueueEmbed(queueData, {
        current: safeIndex + 1,
        total: active.length,
      });
      const components = buildCardViewerComponents(active, safeIndex);
      await interaction.update({ embeds: [embed], components });
    } else {
      const updatedEmbed = buildQueueEmbed(queueData);
      const components = buildQueueButtons(
        queueData.id,
        !!queueData.isClosed,
      );
      await interaction.update({ embeds: [updatedEmbed], components });
    }
    return;
  }

  // Acción: Avanzar al siguiente participante
  if (action === "btn_next") {
    if (
      (!queueData.waitingList || queueData.waitingList.length === 0) &&
      (!queueData.currentTurn || queueData.currentTurn.length === 0)
    ) {
      return interaction.reply({
        content: `La cola **${queueData.title}** está vacía.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    const advanceResult = await advanceQueue(
      client,
      queueData,
      user,
      chan,
      interaction.guild,
    );

    if (advanceResult && !advanceResult.success) {
      const whoTag = advanceResult.lastAdvancedBy?.id
        ? `<@${advanceResult.lastAdvancedBy.id}>`
        : "otro usuario";
      return interaction.reply({
        content: `⏳ **Enfriamiento activo:** Debes esperar **${advanceResult.cooldownRemaining} segundo(s)** antes de volver a pasar de turno en **${queueData.title}**.\n*(El turno fue pasado recientemente por ${whoTag} para evitar saltos involuntarios).*`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    saveQueues();
    if (interaction.message.id !== queueData.messageId) {
      await updateQueueMessage(client, queueData, chan);
    }

    if (interaction.message.components?.length === 3) {
      const active = getQueuesInChannel(channelId);
      const currentIndex = active.findIndex((q) => q.id === queueData.id);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const embed = buildQueueEmbed(queueData, {
        current: safeIndex + 1,
        total: active.length,
      });
      const components = buildCardViewerComponents(active, safeIndex);
      await interaction.update({ embeds: [embed], components });
    } else {
      const updatedEmbed = buildQueueEmbed(queueData);
      const components = buildQueueButtons(
        queueData.id,
        !!queueData.isClosed,
      );
      await interaction.update({ embeds: [updatedEmbed], components });
    }
    return;
  }

  // Acción: Deshacer / revertir turno
  if (action === "btn_undo") {
    const reverted = await undoQueue(queueData, chan);
    if (!reverted) {
      return interaction.reply({
        content: `No hay turnos anteriores para revertir en **${queueData.title}**.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    saveQueues();
    if (interaction.message.id !== queueData.messageId) {
      await updateQueueMessage(client, queueData, chan);
    }

    if (interaction.message.components?.length === 3) {
      const active = getQueuesInChannel(channelId);
      const currentIndex = active.findIndex((q) => q.id === queueData.id);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const embed = buildQueueEmbed(queueData, {
        current: safeIndex + 1,
        total: active.length,
      });
      const components = buildCardViewerComponents(active, safeIndex);
      await interaction.update({ embeds: [embed], components });
    } else {
      const updatedEmbed = buildQueueEmbed(queueData);
      const components = buildQueueButtons(
        queueData.id,
        !!queueData.isClosed,
      );
      await interaction.update({ embeds: [updatedEmbed], components });
    }
    return;
  }
}
