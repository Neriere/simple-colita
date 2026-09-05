import { MessageFlags } from "discord.js";
import { queues, saveQueues } from "../../storage/queueStore.js";
import { buildQueueEmbed } from "../../ui/queueEmbed.js";
import { buildQueueButtons } from "../../ui/queueComponents.js";
import { resolveChannel } from "../../utils/discordUtils.js";

export async function handleMostrar(interaction, client) {
  const { options } = interaction;
  const channelId = interaction.channelId || interaction.channel?.id;
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
