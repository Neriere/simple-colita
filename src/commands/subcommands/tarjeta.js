import { MessageFlags } from "discord.js";
import { getFilteredQueuesInChannel } from "../../storage/queueStore.js";
import { buildQueueEmbed } from "../../ui/queueEmbed.js";
import { buildCardViewerComponents } from "../../ui/queueComponents.js";

export async function handleTarjeta(interaction) {
  const channelId = interaction.channelId || interaction.channel?.id;
  const zone = interaction.options.getString("zona") || null;
  const potionLevel = interaction.options.getInteger("nivel") || null;

  const filters = {};
  if (zone) filters.zone = zone;
  if (potionLevel) filters.potionLevel = potionLevel;

  const active = getFilteredQueuesInChannel(channelId, filters);

  if (active.length === 0) {
    let emptyMsg = "No hay ninguna cola activa en este canal";
    const details = [];
    if (zone) details.push(`zona **${zone}**`);
    if (potionLevel) details.push(`nivel **${potionLevel}**`);
    if (details.length > 0) {
      emptyMsg += ` con el filtro de ${details.join(" y ")}`;
    }
    emptyMsg += ".";
    return interaction.reply({
      content: emptyMsg,
      flags: [MessageFlags.Ephemeral],
    });
  }

  // Clave codificada del filtro para mantenerlo en los botones de navegación
  // Formato: z=<zona>|lvl=<nivel>
  const filterParts = [];
  if (zone) filterParts.push(`z=${zone}`);
  if (potionLevel) filterParts.push(`lvl=${potionLevel}`);
  const filterKey = filterParts.length > 0 ? filterParts.join("|") : "all";

  const firstIndex = 0;
  const currentQueue = active[firstIndex];

  let filterLabel = "";
  if (zone && potionLevel) filterLabel = `${zone} • Lv.${potionLevel}`;
  else if (zone) filterLabel = zone;
  else if (potionLevel) filterLabel = `Lv.${potionLevel}`;

  const embed = buildQueueEmbed(currentQueue, {
    current: 1,
    total: active.length,
    filterLabel,
  });
  const components = buildCardViewerComponents(active, firstIndex, filterKey);

  const titleHeader = filterLabel
    ? ` **Tarjeta interactiva de colas [Filtro: ${filterLabel}]** (Navega con < y > o únete):`
    : ` **Tarjeta interactiva de colas** (Cualquiera puede navegar con < y > o unirse):`;

  return interaction.reply({
    content: titleHeader,
    embeds: [embed],
    components,
  });
}
