import { MessageFlags } from "discord.js";
import { saveQueues } from "../../storage/queueStore.js";
import { resolveChannel } from "../../utils/discordUtils.js";
import { undoQueue, updateQueueMessage } from "../../services/queueService.js";
import { getSingleQueueOrReply } from "../commandHelpers.js";

export async function handleAtras(interaction, client) {
  const queueData = await getSingleQueueOrReply(interaction, {
    actionNotice: "revertir turno",
  });
  if (!queueData) return;

  const channelId = interaction.channelId || interaction.channel?.id;
  const user = interaction.user;
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
