import { getQueuesInChannel } from "../storage/queueStore.js";
import { DOFUS_ZONES } from "../config/constants.js";

/** Manejador de autocompletado para opciones de cola y zona en comandos Slash */
export async function handleAutocompleteInteraction(interaction) {
  const focusedOption = interaction.options.getFocused(true);
  const focusedValue = (focusedOption?.value || "").toLowerCase();

  // Autocompletado para el parámetro 'zona'
  if (focusedOption.name === "zona") {
    const matchingZones = DOFUS_ZONES.filter((z) =>
      z.toLowerCase().includes(focusedValue),
    );
    return await interaction.respond(
      matchingZones.slice(0, 25).map((z) => ({
        name: z,
        value: z,
      })),
    );
  }

  // Autocompletado para nombres de cola
  const channelId = interaction.channelId || interaction.channel?.id;
  const channelQueues = getQueuesInChannel(channelId);

  const filtered = channelQueues.filter(
    (q) =>
      q.title.toLowerCase().includes(focusedValue) ||
      q.id.toLowerCase().includes(focusedValue),
  );

  return await interaction.respond(
    filtered.slice(0, 25).map((q) => ({
      name: `${q.isClosed ? "[CERRADA] " : ""}${q.title} (${(q.currentTurn?.length || 0) + (q.waitingList?.length || 0)} personas)`,
      value: q.id,
    })),
  );
}
