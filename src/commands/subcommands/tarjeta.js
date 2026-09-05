import { MessageFlags } from "discord.js";
import { getQueuesInChannel } from "../../storage/queueStore.js";
import { buildQueueEmbed } from "../../ui/queueEmbed.js";
import { buildCardViewerComponents } from "../../ui/queueComponents.js";

export async function handleTarjeta(interaction) {
  const channelId = interaction.channelId || interaction.channel?.id;
  const active = getQueuesInChannel(channelId);

  if (active.length === 0) {
    return interaction.reply({
      content: "No hay ninguna cola activa en este canal.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  const firstIndex = 0;
  const currentQueue = active[firstIndex];
  const embed = buildQueueEmbed(currentQueue, {
    current: 1,
    total: active.length,
  });
  const components = buildCardViewerComponents(active, firstIndex);

  return interaction.reply({
    content: ` **Tarjeta interactiva de colas** (Cualquiera puede navegar con < y > o unirse):`,
    embeds: [embed],
    components,
  });
}
