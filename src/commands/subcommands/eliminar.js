import { MessageFlags } from "discord.js";
import { queues, saveQueues } from "../../storage/queueStore.js";
import { resolveChannel } from "../../utils/discordUtils.js";

export async function handleEliminar(interaction, client) {
  const targetQueueId = interaction.options.getString("cola");
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
