import { MessageFlags } from "discord.js";
import {
  queues,
  saveQueues,
  getFilteredQueuesInChannel,
} from "../../storage/queueStore.js";
import { buildQueueEmbed } from "../../ui/queueEmbed.js";
import { buildQueueButtons } from "../../ui/queueComponents.js";
import { resolveChannel } from "../../utils/discordUtils.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function handleMostrar(interaction, client) {
  const { options } = interaction;
  const channelId = interaction.channelId || interaction.channel?.id;
  const targetQueueId = options.getString("cola");
  const targetZone = options.getString("zona");

  // Caso 1: Se proporcionó una zona -> Publicar todas las colas individuales de esa zona
  if (targetZone && !targetQueueId) {
    // Buscar todas las colas pertenecientes a esa zona en la base de datos
    const zoneQueues = [];
    for (const q of queues.values()) {
      const qZone = (q.zone || "").trim().toLowerCase();
      if (
        qZone.includes(targetZone.toLowerCase()) ||
        targetZone.toLowerCase().includes(qZone)
      ) {
        zoneQueues.push(q);
      }
    }

    if (zoneQueues.length === 0) {
      return interaction.reply({
        content: `No se encontraron colas para la zona **${targetZone}**.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Ordenar de menor a mayor nivel (o por título si tienen igual nivel)
    zoneQueues.sort((a, b) => {
      const lvlA = a.potionLevel || 0;
      const lvlB = b.potionLevel || 0;
      if (lvlA !== lvlB) return lvlA - lvlB;
      return a.title.localeCompare(b.title);
    });

    const channel = interaction.channel;
    if (!channel || typeof channel.send !== "function") {
      return interaction.reply({
        content: "No se pudo acceder al canal actual para enviar los mensajes de cola.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Responder inicialmente para confirmar y no bloquear el timeout de 3 segundos de Discord
    await interaction.reply({
      content: ` Generando paneles individuales para las **${zoneQueues.length} colas** de la zona **${targetZone}** en este canal...\n*Se enviarán de forma escalonada para evitar rate limits de Discord.*`,
      flags: [MessageFlags.Ephemeral],
    });

    let postedCount = 0;
    for (let i = 0; i < zoneQueues.length; i++) {
      const q = zoneQueues[i];

      // Eliminar el mensaje anterior de esta cola si existía en algún canal
      if (q.messageId && q.channelId) {
        try {
          const oldChan = await resolveChannel(client, q.channelId, channel);
          if (oldChan) {
            const oldMsg = await oldChan.messages.fetch(q.messageId).catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => {});
          }
        } catch {}
      }

      // Generar el Embed y los botones individuales de esta cola
      const embed = buildQueueEmbed(q);
      const components = buildQueueButtons(q.id, !!q.isClosed);

      try {
        const sentMsg = await channel.send({
          embeds: [embed],
          components,
        });

        // Vincular el nuevo mensaje y el canal actual a esta cola
        q.messageId = sentMsg.id;
        q.channelId = channelId;
        postedCount++;

        // Pequeño retardo entre envíos para respetar los límites de la API de Discord
        if (i < zoneQueues.length - 1) {
          await delay(450);
        }
      } catch (err) {
        console.error(`Error enviando mensaje para la cola ${q.title}:`, err);
        // Si Discord nos aplica rate limit o error, esperar 1.5 segundos adicionales
        await delay(1500);
      }
    }

    // Guardar los nuevos messageId y channelId en persistencia
    saveQueues();

    // Actualizar la respuesta efímera del usuario notificando que se completó
    return interaction.editReply({
      content: ` Se publicaron exitosamente **${postedCount} colas** de la zona **${targetZone}** en este canal. Cada una cuenta con sus botones independientes y persistencia en tiempo real.`,
    });
  }

  // Caso 2: Se especificó una cola individual
  if (!targetQueueId) {
    return interaction.reply({
      content:
        "Debes especificar al menos el parámetro `cola` (para una sola) o `zona` (para publicar todas las de esa zona).",
      flags: [MessageFlags.Ephemeral],
    });
  }

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
  const components = buildQueueButtons(queueData.id, !!queueData.isClosed);

  const newMsg = await interaction.reply({
    embeds: [embed],
    components,
    fetchReply: true,
  });

  queueData.messageId = newMsg.id;
  queueData.channelId = channelId;
  saveQueues();
}
