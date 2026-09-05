import { MessageFlags } from "discord.js";
import { saveQueues } from "../../storage/queueStore.js";
import { buildQueueEmbed } from "../../ui/queueEmbed.js";
import { buildQueueButtons } from "../../ui/queueComponents.js";
import { resolveChannel, autoDeleteReply } from "../../utils/discordUtils.js";
import { getSingleQueueOrReply } from "../commandHelpers.js";

export async function handleMover(interaction, client) {
  const { options } = interaction;
  const targetChannel = options.getChannel("canal");

  const queueData = await getSingleQueueOrReply(interaction, {
    actionNotice: "mover de canal",
  });
  if (!queueData) return;

  if (queueData.channelId === targetChannel.id) {
    return interaction.reply({
      content: `La cola **${queueData.title}** ya se encuentra en el canal <#${targetChannel.id}>.`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  const oldChannelId = queueData.channelId;

  // 1. Borrar el mensaje/panel en el canal antiguo si existe
  try {
    const oldChan = await resolveChannel(
      client,
      oldChannelId,
      interaction.channel,
    );
    if (oldChan && queueData.messageId) {
      const oldMsg =
        oldChan.messages.cache.get(queueData.messageId) ||
        (await oldChan.messages.fetch(queueData.messageId).catch(() => null));
      if (oldMsg) {
        await oldMsg.delete().catch(() => null);
      }
    }
  } catch (err) {
    console.error("Error borrando mensaje anterior en canal origen:", err.message);
  }

  // 2. Publicar nuevo panel interactivo en el canal de destino
  let newMsg = null;
  try {
    const destChan = await resolveChannel(
      client,
      targetChannel.id,
      interaction.guild?.channels.cache.get(targetChannel.id),
    );
    if (!destChan) {
      return interaction.reply({
        content: `No se pudo acceder al canal de destino <#${targetChannel.id}>. Verifica los permisos del bot.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    const embed = buildQueueEmbed(queueData);
    const buttons = buildQueueButtons(queueData.id, queueData.isClosed);
    newMsg = await destChan.send({
      embeds: [embed],
      components: buttons,
    });
  } catch (err) {
    console.error("Error publicando panel en canal destino:", err.message);
    return interaction.reply({
      content: `Error al crear el panel en <#${targetChannel.id}>: ${err.message}`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  // 3. Actualizar la ubicación en la base de datos
  queueData.channelId = targetChannel.id;
  if (newMsg) {
    queueData.messageId = newMsg.id;
  }
  saveQueues();

  const replyPromise = interaction.reply({
    content: `La cola **${queueData.title}** ha sido trasladada con éxito al canal <#${targetChannel.id}> con todos sus participantes y turnos intactos.`,
  });
  autoDeleteReply(interaction, 15);
  return replyPromise;
}
