import { saveQueues } from "../../storage/queueStore.js";
import { autoDeleteReply } from "../../utils/discordUtils.js";
import { getTargetQueues, syncQueueMessages } from "../commandHelpers.js";

export async function handleVaciar(interaction, client) {
  await interaction.deferReply();

  const targetList = getTargetQueues(interaction, {
    allowGuildFallback: true,
  });

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

  await syncQueueMessages(client, targetList, interaction.channel);

  const replyPromise = interaction.editReply({
    content: ` **Colas vaciadas:** Se han limpiado los turnos activos y la lista de espera de **${targetList.length} cola(s)**.`,
  });
  autoDeleteReply(interaction, 10);
  return replyPromise;
}
