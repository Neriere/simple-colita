import { getQueuesInChannel } from "../storage/queueStore.js";

/** Manejador de autocompletado para opciones de cola en comandos Slash */
export async function handleAutocompleteInteraction(interaction) {
  const channelId = interaction.channelId || interaction.channel?.id;
  const focusedValue = interaction.options.getFocused().toLowerCase();
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
