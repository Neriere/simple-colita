import { queues, saveQueues } from "../../storage/queueStore.js";
import { buildQueueEmbed } from "../../ui/queueEmbed.js";
import { buildQueueButtons } from "../../ui/queueComponents.js";

export async function handleCrear(interaction) {
  const { options, user } = interaction;
  const channelId = interaction.channelId || interaction.channel?.id;

  const title = options.getString("titulo");
  const potionLevel = options.getInteger("nivel") || null;
  const description = options.getString("descripcion") || "";
  const maxCapacity = options.getInteger("limite") || 0;
  const slotsPerTurn = options.getInteger("por_turno") || 1;
  const advanceCooldown = options.getInteger("cooldown") ?? 60;
  const iconUrl = options.getString("icono") || null;
  const bannerUrl = options.getString("banner") || null;
  const queueId = `q_${Date.now()}`;

  const queueData = {
    id: queueId,
    title,
    potionLevel,
    description,
    iconUrl,
    bannerUrl,
    hostId: user.id,
    host: { id: user.id, username: user.username },
    maxCapacity,
    slotsPerTurn,
    advanceCooldown,
    isClosed: false,
    createdAt: new Date().toISOString(),
    currentTurn: [],
    waitingList: [],
    pastTurns: [],
    history: [],
    lastAdvancedBy: null,
    lastAdvancedAt: null,
    channelId,
    messageId: null,
  };

  const embed = buildQueueEmbed(queueData);
  const components = buildQueueButtons(queueId, false);

  const message = await interaction.reply({
    embeds: [embed],
    components,
    fetchReply: true,
  });

  queueData.messageId = message.id;
  queues.set(queueId, queueData);
  saveQueues();
}
