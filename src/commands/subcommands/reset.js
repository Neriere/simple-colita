import { queues, saveQueues } from "../../storage/queueStore.js";
import { autoDeleteReply } from "../../utils/discordUtils.js";
import { syncQueueMessages } from "../commandHelpers.js";

export async function handleReset(interaction, client) {
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

  await syncQueueMessages(client, targetList, interaction.channel);

  const replyPromise = interaction.editReply({
    content: ` **Reinicio Diario Completado:** Se han limpiado los turnos activos, la lista de espera y el historial de **todas las colas** (${targetList.length} en total). Han quedado cerradas y se abrirán automáticamente a las **18:00 (Chile)** o cuando uses \`/cola abrir\`.`,
  });
  autoDeleteReply(interaction, 12);
  return replyPromise;
}
