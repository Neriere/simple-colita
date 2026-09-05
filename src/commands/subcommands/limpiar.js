import {
  resolveChannel,
  cleanChannelExtraneousMessages,
  autoDeleteReply,
} from "../../utils/discordUtils.js";

export async function handleLimpiar(interaction, client) {
  await interaction.deferReply();

  const channelId = interaction.channelId || interaction.channel?.id;
  const chan = await resolveChannel(client, channelId, interaction.channel);
  const deletedCount = await cleanChannelExtraneousMessages(chan, 100);

  const replyPromise = interaction.editReply({
    content: ` **Canal limpiado:** Se han eliminado **${deletedCount}** mensaje(s) ajenos. Los paneles oficiales de las colas se mantienen intactos.`,
  });
  autoDeleteReply(interaction, 10);
  return replyPromise;
}
