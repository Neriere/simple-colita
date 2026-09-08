import { MessageFlags } from "discord.js";
import { getQueuesInChannel } from "../../storage/queueStore.js";
import { buildQueueEmbed } from "../../ui/queueEmbed.js";
import { buildCardViewerComponents } from "../../ui/queueComponents.js";

export async function handleListar(interaction) {
  const { options, user } = interaction;
  const channelId = interaction.channelId || interaction.channel?.id;
  const active = getQueuesInChannel(channelId);
  const uid = user.id;
  const me = options.getBoolean("propias");
  const firstIndex = 0;
  let currentQueue = {};
  let components;
  let embed;

  if (active.length === 0) {
    return interaction.reply({
      content: "No hay ninguna cola activa en este canal.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  const misColas = Object.values(active).filter(c =>
      c.channelId === interaction.channelId &&
      (c.currentTurn.some(e => e.id === uid) || c.waitingList.some(e => e.id === uid)),
    );

  if (misColas.length === 0 && me) {
    return interaction.reply({
      content: "No estas en ninguna cola activa en este canal.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (!me){
    currentQueue = active[firstIndex];
    embed = buildQueueEmbed(currentQueue, {
      current: 1,
      total: active.length,
    });
    components = buildCardViewerComponents(active, firstIndex);
  } else {
    currentQueue = misColas[firstIndex];
    embed = buildQueueEmbed(currentQueue, {
      current: 1,
        total: misColas.length,
    });
    components = buildCardViewerComponents(misColas, firstIndex);
  }
  
  return interaction.reply({
    content: ` **Tu visor privado de colas** (Solo tú lo ves):`,
    embeds: [embed],
    components,
    flags: [MessageFlags.Ephemeral],
  });
}
