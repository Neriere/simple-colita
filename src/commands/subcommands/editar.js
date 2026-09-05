import { MessageFlags } from "discord.js";
import { queues, saveQueues } from "../../storage/queueStore.js";
import { resolveChannel } from "../../utils/discordUtils.js";
import { updateQueueMessage } from "../../services/queueService.js";

export async function handleEditar(interaction, client) {
  const { options } = interaction;
  const targetQueueId = options.getString("cola");
  const queueData = queues.get(targetQueueId);

  if (!queueData) {
    return interaction.reply({
      content: "No se encontró la cola especificada.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  const newTitle = options.getString("titulo");
  const newLevel = options.getInteger("nivel");
  const newDesc = options.getString("descripcion");
  const newIcon = options.getString("icono");
  const newBanner = options.getString("banner");
  const newLimit = options.getInteger("limite");
  const newSlots = options.getInteger("por_turno");
  const newCooldown = options.getInteger("cooldown");

  if (newTitle !== null) queueData.title = newTitle;
  if (newLevel !== null)
    queueData.potionLevel = newLevel === 0 ? null : newLevel;
  if (newDesc !== null) queueData.description = newDesc;
  if (newIcon !== null)
    queueData.iconUrl = newIcon.toLowerCase() === "quitar" ? null : newIcon;
  if (newBanner !== null)
    queueData.bannerUrl = newBanner.toLowerCase() === "quitar" ? null : newBanner;
  if (newLimit !== null) queueData.maxCapacity = newLimit;
  if (newSlots !== null) queueData.slotsPerTurn = newSlots;
  if (newCooldown !== null) queueData.advanceCooldown = newCooldown;

  saveQueues();
  const chan = await resolveChannel(
    client,
    queueData.channelId,
    interaction.channel,
  );
  await updateQueueMessage(client, queueData, chan);

  const levelNotice =
    newLevel !== null
      ? newLevel > 0
        ? ` (Nivel asignado: Lv. ${newLevel})`
        : " (Nivel removido)"
      : "";
  const cooldownNotice =
    newCooldown !== null
      ? newCooldown > 0
        ? ` (Cooldown: ${newCooldown}s)`
        : " (Cooldown desactivado)"
      : "";

  return interaction.reply({
    content: ` Se actualizó la cola **${queueData.title}** exitosamente${levelNotice}${cooldownNotice}.`,
    flags: [MessageFlags.Ephemeral],
  });
}
