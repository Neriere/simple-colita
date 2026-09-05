import { MessageFlags } from "discord.js";
import { queues, getQueuesInChannel } from "../storage/queueStore.js";
import { resolveChannel } from "../utils/discordUtils.js";
import { updateQueueMessage } from "../services/queueService.js";

/**
 * Resuelve una única cola objetivo para un comando.
 * Si el usuario no especificó ID, autodetecta si hay 1 sola cola en el canal.
 * Si no se encuentra o hay ambigüedad (> 1 cola sin especificar), responde de inmediato
 * con un mensaje informativo efímero y retorna null.
 */
export async function getSingleQueueOrReply(
  interaction,
  {
    actionNotice = "ejecutar este comando",
    optionName = "cola",
  } = {},
) {
  const targetQueueId = interaction.options.getString(optionName);
  const channelId = interaction.channelId || interaction.channel?.id;

  if (targetQueueId) {
    const queueData = queues.get(targetQueueId);
    if (!queueData) {
      await interaction.reply({
        content: "No se encontró la cola especificada.",
        flags: [MessageFlags.Ephemeral],
      });
      return null;
    }
    return queueData;
  }

  const channelQueues = getQueuesInChannel(channelId);
  if (channelQueues.length === 1) {
    return channelQueues[0];
  }

  if (channelQueues.length > 1) {
    await interaction.reply({
      content: `Hay ${channelQueues.length} colas activas en este canal. Especifica cuál deseas para ${actionNotice} usando la opción \`cola:<nombre>\` o usa los botones directos del panel.`,
      flags: [MessageFlags.Ephemeral],
    });
    return null;
  }

  await interaction.reply({
    content: "No se encontró ninguna cola activa en este canal.",
    flags: [MessageFlags.Ephemeral],
  });
  return null;
}

/**
 * Obtiene la lista de colas objetivo para operaciones masivas (abrir, cerrar, vaciar).
 */
export function getTargetQueues(
  interaction,
  { allowGuildFallback = false, optionName = "cola" } = {},
) {
  const targetQueueId = interaction.options.getString(optionName);
  const channelId = interaction.channelId || interaction.channel?.id;

  if (targetQueueId) {
    const q = queues.get(targetQueueId);
    return q ? [q] : [];
  }

  const channelQueues = getQueuesInChannel(channelId);
  if (channelQueues.length > 0) {
    return channelQueues;
  }

  if (allowGuildFallback) {
    const allGuild = Array.from(queues.values()).filter(
      (q) => !q.guildId || q.guildId === interaction.guildId,
    );
    return allGuild.length > 0 ? allGuild : Array.from(queues.values());
  }

  return [];
}

/**
 * Actualiza en paralelo los mensajes en Discord de un lote de colas.
 */
export async function syncQueueMessages(client, queueList, fallbackChannel) {
  return Promise.allSettled(
    queueList.map(async (q) => {
      try {
        const chan = await resolveChannel(
          client,
          q.channelId,
          fallbackChannel,
        );
        if (chan) {
          await updateQueueMessage(client, q, chan);
        }
      } catch (err) {
        console.error(`Error al sincronizar mensaje de cola ${q.title}:`, err);
      }
    }),
  );
}
