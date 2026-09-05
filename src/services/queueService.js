import { EmbedBuilder } from "discord.js";
import { saveQueues } from "../storage/queueStore.js";
import { buildQueueEmbed } from "../ui/queueEmbed.js";
import { buildQueueButtons } from "../ui/queueComponents.js";
import { resolveChannel } from "../utils/discordUtils.js";

/** Actualiza el mensaje principal del panel de la cola en Discord. */
export async function updateQueueMessage(client, queueData, channel = null) {
  if (!queueData || !queueData.messageId) return;
  try {
    const chan = await resolveChannel(client, queueData.channelId, channel);
    if (!chan) return;
    const msg =
      chan.messages.cache.get(queueData.messageId) ||
      (await chan.messages.fetch(queueData.messageId).catch(() => null));
    if (msg) {
      const embed = buildQueueEmbed(queueData);
      const components = buildQueueButtons(queueData.id, !!queueData.isClosed);
      await msg.edit({ embeds: [embed], components }).catch((err) => {
        console.error("Error editando mensaje de cola:", err);
      });
    }
  } catch (err) {
    console.error("Error en updateQueueMessage:", err);
  }
}

/** Envía la notificación de turno al usuario (tanto en el canal como por mensaje directo). */
export async function notifyUserTurn(client, member, queueData, channel, advancedByUser) {
  const noteText = member.note ? ` (\`${member.note}\`)` : "";
  const advancedByText = advancedByUser
    ? ` *(avanzado por <@${advancedByUser.id}>)*`
    : "";

  // 1. Mensaje en el canal con mención (se auto-elimina a los 10 minutos)
  if (channel && typeof channel.send === "function") {
    try {
      const allowedUsers = [member.id];
      if (advancedByUser?.id) allowedUsers.push(advancedByUser.id);

      const pingMsg = await channel.send({
        content: `<@${member.id}>${noteText}, es tu turno en **${queueData.title}**${advancedByText}.`,
        allowedMentions: {
          users: allowedUsers,
        },
      });

      setTimeout(
        () => {
          pingMsg.delete().catch(() => {});
        },
        10 * 60 * 1000,
      );
    } catch (err) {
      console.error("Error enviando ping en canal:", err);
    }
  }

  // 2. Mensaje Directo (DM) privado al usuario
  try {
    const discordUser = await client.users.fetch(member.id).catch(() => null);
    if (discordUser) {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`¡Es tu turno en ${queueData.title}! `)
        .setDescription(
          `Has sido llamado a tu turno.${advancedByUser ? `\n**Avanzado por:** <@${advancedByUser.id}>` : ""}`,
        )
        .setColor("#23A55A")
        .setTimestamp();

      await discordUser.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  } catch (err) {
    console.error("Error enviando DM al usuario:", err);
  }
}

/** Avanza el turno de la cola al siguiente usuario. */
export async function advanceQueue(client, queueData, user, channel, guild = null) {
  if (!queueData.history) queueData.history = [];
  if (!queueData.pastTurns) queueData.pastTurns = [];
  if (!queueData.currentTurn) queueData.currentTurn = [];
  if (!queueData.waitingList) queueData.waitingList = [];

  queueData.history.push({
    currentTurn: JSON.parse(JSON.stringify(queueData.currentTurn)),
    waitingListIds: queueData.waitingList.map((u) => u.id),
    pastTurns: JSON.parse(JSON.stringify(queueData.pastTurns)),
    lastAdvancedBy: queueData.lastAdvancedBy,
  });

  if (queueData.history.length > 10) {
    queueData.history.shift();
  }

  if (queueData.currentTurn.length > 0) {
    for (const u of queueData.currentTurn) {
      queueData.pastTurns.push({
        ...u,
        completedAt: Date.now(),
      });
    }
    if (queueData.pastTurns.length > 10) {
      queueData.pastTurns = queueData.pastTurns.slice(-10);
    }
  }

  queueData.currentTurn = [];
  queueData.lastAdvancedBy = { id: user.id, username: user.username };

  const slots = queueData.slotsPerTurn || 1;
  while (
    queueData.currentTurn.length < slots &&
    queueData.waitingList.length > 0
  ) {
    const nextMember = queueData.waitingList.shift();
    nextMember.turnStartTime = Date.now();

    if (guild && nextMember.id) {
      try {
        const mem = await guild.members.fetch(nextMember.id).catch(() => null);
        if (mem) {
          nextMember.displayName =
            mem.nickname ||
            mem.displayName ||
            nextMember.displayName ||
            nextMember.username;
        }
      } catch {}
    }

    queueData.currentTurn.push(nextMember);
    notifyUserTurn(client, nextMember, queueData, channel, user);
  }
}

/** Revierte el último avance de turno restaurando el estado previo. */
export async function undoQueue(queueData, channel) {
  if (!queueData.history || queueData.history.length === 0) return false;

  const previousState = queueData.history.pop();
  const promotedNow = [...(queueData.currentTurn || [])];

  const prevWaitingIds = new Set(previousState.waitingListIds || []);
  const newlyJoinedUsers = (queueData.waitingList || []).filter(
    (u) => !prevWaitingIds.has(u.id),
  );

  const restoredWaiting = [];
  for (const u of promotedNow) {
    restoredWaiting.push(u);
  }
  for (const u of queueData.waitingList || []) {
    if (!newlyJoinedUsers.some((nu) => nu.id === u.id)) {
      restoredWaiting.push(u);
    }
  }
  for (const nu of newlyJoinedUsers) {
    if (
      !restoredWaiting.some((u) => u.id === nu.id) &&
      !previousState.currentTurn.some((u) => u.id === nu.id)
    ) {
      restoredWaiting.push(nu);
    }
  }

  queueData.currentTurn = previousState.currentTurn || [];
  queueData.waitingList = restoredWaiting;
  queueData.pastTurns = previousState.pastTurns || [];
  queueData.lastAdvancedBy = previousState.lastAdvancedBy || null;

  if (channel && typeof channel.send === "function") {
    try {
      const undoMsg = await channel.send(
        ` **Turno revertido:** Se ha restaurado la posición anterior en **${queueData.title}**.`,
      );
      setTimeout(() => {
        undoMsg.delete().catch(() => {});
      }, 15000);
    } catch (e) {
      console.error("Error avisando reversión:", e);
    }
  }

  return true;
}
