import { saveQueues } from "../../storage/queueStore.js";
import { autoDeleteReply } from "../../utils/discordUtils.js";
import { getTargetQueues, syncQueueMessages } from "../commandHelpers.js";

export async function handleCerrar(interaction, client) {
  await interaction.deferReply();

  const shouldVaciar = interaction.options.getBoolean("vaciar") ?? true;
  const targetList = getTargetQueues(interaction, {
    allowGuildFallback: true,
  });

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

  await syncQueueMessages(client, targetList, interaction.channel);

  const vaciarMsg = shouldVaciar
    ? " y se han **vaciado los turnos activos y la lista de espera**"
    : "";
  const replyPromise = interaction.editReply({
    content: `[CERRADA] **Colas cerradas:** Se ha pausado la recepción de participantes en **${targetList.length} cola(s)**${vaciarMsg}. Para reabrir usa \`/cola abrir\`.`,
  });
  autoDeleteReply(interaction, 10);
  return replyPromise;
}
