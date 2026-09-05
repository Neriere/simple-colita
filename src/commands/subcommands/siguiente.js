import { MessageFlags } from "discord.js";
import { saveQueues } from "../../storage/queueStore.js";
import { resolveChannel } from "../../utils/discordUtils.js";
import { advanceQueue, updateQueueMessage } from "../../services/queueService.js";
import { getSingleQueueOrReply } from "../commandHelpers.js";

export async function handleSiguiente(interaction, client) {
  const queueData = await getSingleQueueOrReply(interaction, {
    actionNotice: "avanzar de turno",
  });
  if (!queueData) return;

  const channelId = interaction.channelId || interaction.channel?.id;
  const user = interaction.user;
  const chan = await resolveChannel(client, channelId, interaction.channel);

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
  await updateQueueMessage(client, queueData, chan);
  return interaction.reply({
    content: `Turno avanzado en **${queueData.title}** por <@${user.id}>.`,
    flags: [MessageFlags.Ephemeral],
  });
}
