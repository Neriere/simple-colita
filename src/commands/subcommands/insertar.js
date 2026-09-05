import { MessageFlags } from "discord.js";
import { saveQueues } from "../../storage/queueStore.js";
import {
  resolveChannel,
  autoDeleteReply,
  getMemberDisplayName,
} from "../../utils/discordUtils.js";
import { updateQueueMessage } from "../../services/queueService.js";
import { getSingleQueueOrReply } from "../commandHelpers.js";

export async function handleInsertar(interaction, client) {
  const { options } = interaction;
  const channelId = interaction.channelId || interaction.channel?.id;
  const targetUser = options.getUser("usuario");
  const targetPos = options.getInteger("posicion");
  const note = options.getString("nota") || "";

  const queueData = await getSingleQueueOrReply(interaction, {
    actionNotice: "insertar un participante",
  });
  if (!queueData) return;

  if (targetPos < 1) {
    return interaction.reply({
      content: "La posición debe ser 1 o superior.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  const displayName = await getMemberDisplayName(
    interaction.guild,
    targetUser,
  );

  const participant = {
    id: targetUser.id,
    username: targetUser.username,
    displayName: displayName,
    joinedAt: Date.now(),
    turnStartTime: Date.now(),
    note: note,
  };

  if (!queueData.waitingList) queueData.waitingList = [];
  if (!queueData.currentTurn) queueData.currentTurn = [];

  queueData.waitingList = queueData.waitingList.filter(
    (u) => u.id !== targetUser.id,
  );
  queueData.currentTurn = queueData.currentTurn.filter(
    (u) => u.id !== targetUser.id,
  );

  const insertIndex = Math.min(
    targetPos - 1,
    queueData.waitingList.length,
  );
  queueData.waitingList.splice(insertIndex, 0, participant);

  saveQueues();
  const chan = await resolveChannel(client, channelId, interaction.channel);
  await updateQueueMessage(client, queueData, chan);

  const replyPromise = interaction.reply({
    content: ` <@${targetUser.id}> (${displayName}) ha sido insertado en la **Posición #${insertIndex + 1}** de la cola **${queueData.title}**${note ? ` con la nota: \`${note}\`` : ""}. Los participantes detrás han sido desplazados automáticamente.`,
  });
  autoDeleteReply(interaction, 12);
  return replyPromise;
}
