import { PermissionFlagsBits } from "discord.js";
import { getQueuesInChannel } from "../storage/queueStore.js";

/** Formatea una fecha en formato de timestamp nativo de Discord (<t:UNIX:flag>). */
export function formatDiscordTimestamp(dateVal, style = "t") {
  if (!dateVal) return "";
  const ms =
    typeof dateVal === "number" ? dateVal : new Date(dateVal).getTime();
  if (isNaN(ms) || ms <= 0) return "";
  const unix = Math.floor(ms / 1000);
  return `<t:${unix}:${style}>`;
}

/** Obtiene o busca un canal de Discord por ID. */
export async function resolveChannel(client, channelId, fallbackChannel = null) {
  if (!channelId) return fallbackChannel || null;
  if (fallbackChannel && fallbackChannel.id === channelId) {
    return fallbackChannel;
  }
  try {
    if (client && client.channels) {
      const cached = client.channels.cache.get(channelId);
      if (cached) return cached;
      return await client.channels.fetch(channelId).catch(() => null);
    }
  } catch {}
  return fallbackChannel || null;
}

/** Elimina automáticamente la respuesta a una interacción tras un retraso en segundos. */
export function autoDeleteReply(interaction, delaySeconds = 10) {
  if (!interaction) return;
  setTimeout(async () => {
    try {
      if (typeof interaction.deleteReply === "function") {
        await interaction.deleteReply().catch(() => {});
      }
    } catch (_) {}
  }, delaySeconds * 1000);
}

/** Limpia mensajes ajenos en el canal de una cola protegiendo los paneles oficiales. */
export async function cleanChannelExtraneousMessages(channel, limit = 50) {
  if (!channel || !channel.guild) return 0;
  try {
    const permissions = channel.permissionsFor(channel.client.user);
    if (!permissions || !permissions.has(PermissionFlagsBits.ManageMessages)) {
      return 0;
    }

    const channelQueues = getQueuesInChannel(channel.id);
    const protectedMessageIds = new Set(
      channelQueues.map((q) => q.messageId).filter(Boolean),
    );

    const messages = await channel.messages
      .fetch({ limit: Math.min(limit, 100) })
      .catch(() => null);
    if (!messages || messages.size === 0) return 0;

    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000 - 60000);
    const toDeleteBulk = [];
    const toDeleteIndividual = [];

    messages.forEach((msg) => {
      if (protectedMessageIds.has(msg.id) || msg.pinned) return;

      if (msg.createdTimestamp > twoWeeksAgo) {
        toDeleteBulk.push(msg);
      } else {
        toDeleteIndividual.push(msg);
      }
    });

    let deletedCount = 0;
    if (toDeleteBulk.length > 0) {
      const deleted = await channel
        .bulkDelete(toDeleteBulk, true)
        .catch(() => null);
      if (deleted) deletedCount += deleted.size;
    }

    for (const msg of toDeleteIndividual) {
      await msg.delete().catch(() => {});
      deletedCount++;
    }

    return deletedCount;
  } catch (err) {
    console.error("Error al limpiar mensajes del canal:", err);
    return 0;
  }
}

/** Obtiene el nombre visible (apodo o display name) de un usuario en el servidor. */
export async function getMemberDisplayName(guild, user, interactionMember = null) {
  if (interactionMember && interactionMember.id === user.id) {
    if (interactionMember.nickname) return interactionMember.nickname;
    if (interactionMember.displayName) return interactionMember.displayName;
  }
  if (guild) {
    try {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (member) {
        return (
          member.nickname ||
          member.displayName ||
          user.globalName ||
          user.username
        );
      }
    } catch {}
  }
  return user.globalName || user.displayName || user.username;
}
