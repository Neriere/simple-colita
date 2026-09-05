import { MessageFlags } from "discord.js";
import {
  queues,
  saveQueues,
  getQueuesInChannel,
} from "../storage/queueStore.js";
import { buildQueueEmbed } from "../ui/queueEmbed.js";
import { buildCardViewerComponents } from "../ui/queueComponents.js";
import { resolveChannel } from "../utils/discordUtils.js";
import { updateQueueMessage } from "../services/queueService.js";

/** Manejador de menús desplegables (Select Menus) */
export async function handleSelectMenuInteraction(interaction, client) {
  const customId = interaction.customId;
  const channelId = interaction.channelId || interaction.channel?.id;

  // Salto rápido a una cola desde el visor de tarjetas
  if (customId === "card_select_jump") {
    const selectedVal = interaction.values[0];
    const active = getQueuesInChannel(channelId);

    if (active.length === 0) {
      return interaction.update({
        content: "No hay colas activas en este canal.",
        embeds: [],
        components: [],
      });
    }

    if (selectedVal.startsWith("page_jump:")) {
      const targetIndex = parseInt(selectedVal.split(":")[1], 10) || 0;
      const safeIndex = Math.max(
        0,
        Math.min(targetIndex, active.length - 1),
      );
      const currentQueue = active[safeIndex];

      const embed = buildQueueEmbed(currentQueue, {
        current: safeIndex + 1,
        total: active.length,
      });
      const components = buildCardViewerComponents(active, safeIndex);
      return interaction.update({ embeds: [embed], components });
    }

    const targetIndex = parseInt(selectedVal, 10) || 0;
    const safeIndex = Math.max(0, Math.min(targetIndex, active.length - 1));
    const currentQueue = active[safeIndex];

    const embed = buildQueueEmbed(currentQueue, {
      current: safeIndex + 1,
      total: active.length,
    });
    const components = buildCardViewerComponents(active, safeIndex);
    return interaction.update({ embeds: [embed], components });
  }

  // Asignación de nivel de poción / mazmorra desde el menú
  if (customId.startsWith("select_set_potion:")) {
    const queueId = customId.split(":")[1];
    const queueData = queues.get(queueId);

    if (!queueData) {
      return interaction.reply({
        content: "Esta cola ya no existe.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const selectedLvl = parseInt(interaction.values[0], 10);
    queueData.potionLevel = selectedLvl > 0 ? selectedLvl : null;
    saveQueues();

    const chan = await resolveChannel(
      client,
      queueData.channelId,
      interaction.channel,
    );
    await updateQueueMessage(client, queueData, chan);

    const active = getQueuesInChannel(channelId);
    const currentIndex = active.findIndex((q) => q.id === queueId);
    if (
      currentIndex !== -1 &&
      interaction.message.interaction?.commandName === undefined
    ) {
      const embed = buildQueueEmbed(queueData, {
        current: currentIndex + 1,
        total: active.length,
      });
      const components = buildCardViewerComponents(active, currentIndex);
      try {
        await interaction.message.edit({ embeds: [embed], components });
      } catch {}
    }

    return interaction.reply({
      content:
        selectedLvl > 0
          ? ` Se asignó el nivel **Lv. ${selectedLvl}** a la cola **${queueData.title}**.`
          : ` Se removió la etiqueta de nivel de la cola **${queueData.title}**.`,
      flags: [MessageFlags.Ephemeral],
    });
  }
}
