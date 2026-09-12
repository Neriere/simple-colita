import { MessageFlags } from "discord.js";
import {
  queues,
  saveQueues,
  getQueuesInChannel,
  getFilteredQueuesInChannel,
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
  if (customId.startsWith("card_select_jump")) {
    const parts = customId.split(":");
    const rawFilterKey = parts[1] ? decodeURIComponent(parts[1]) : "all";

    // Extraer filtros si existen
    const filters = {};
    let filterLabel = "";
    if (rawFilterKey && rawFilterKey !== "all") {
      const tokens = rawFilterKey.split("|");
      for (const token of tokens) {
        if (token.startsWith("z=")) filters.zone = token.substring(2);
        if (token.startsWith("lvl=")) filters.potionLevel = parseInt(token.substring(4), 10);
      }
      if (filters.zone && filters.potionLevel) filterLabel = `${filters.zone} • Lv.${filters.potionLevel}`;
      else if (filters.zone) filterLabel = filters.zone;
      else if (filters.potionLevel) filterLabel = `Lv.${filters.potionLevel}`;
    }

    const selectedVal = interaction.values[0];
    const active = getFilteredQueuesInChannel(channelId, filters);

    if (active.length === 0) {
      return interaction.update({
        content: "No hay colas activas en este canal para el filtro seleccionado.",
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
        filterLabel,
      });
      const components = buildCardViewerComponents(active, safeIndex, rawFilterKey);
      return interaction.update({ embeds: [embed], components });
    }

    const targetIndex = parseInt(selectedVal, 10) || 0;
    const safeIndex = Math.max(0, Math.min(targetIndex, active.length - 1));
    const currentQueue = active[safeIndex];

    const embed = buildQueueEmbed(currentQueue, {
      current: safeIndex + 1,
      total: active.length,
      filterLabel,
    });
    const components = buildCardViewerComponents(active, safeIndex, rawFilterKey);
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
