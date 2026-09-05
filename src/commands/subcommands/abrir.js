import { saveQueues } from "../../storage/queueStore.js";
import { autoDeleteReply } from "../../utils/discordUtils.js";
import { getTargetQueues, syncQueueMessages } from "../commandHelpers.js";

export async function handleAbrir(interaction, client) {
  await interaction.deferReply();

  const targetList = getTargetQueues(interaction, {
    allowGuildFallback: false,
  });

  if (targetList.length === 0) {
    const replyPromise = interaction.editReply({
      content: "No se encontraron colas para abrir en este canal.",
    });
    autoDeleteReply(interaction, 8);
    return replyPromise;
  }

  for (const q of targetList) {
    q.isClosed = false;
  }
  saveQueues();

  await syncQueueMessages(client, targetList, interaction.channel);

  const replyPromise = interaction.editReply({
    content: ` **Colas abiertas:** Se ha reanudado la recepción de participantes en ${targetList.length} cola(s). ¡Ya pueden unirse!`,
  });
  autoDeleteReply(interaction, 10);
  return replyPromise;
}
