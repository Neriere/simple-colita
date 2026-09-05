import { EmbedBuilder } from "discord.js";
import { getPotionInfo } from "../config/constants.js";
import { formatDiscordTimestamp } from "../utils/discordUtils.js";

/** Genera el Embed de Discord para representar el estado visual de la cola. */
export function buildQueueEmbed(queueData, pageInfo = null) {
  const {
    title,
    description,
    currentTurn,
    waitingList,
    maxCapacity,
    slotsPerTurn,
    lastAdvancedBy,
    pastTurns,
    iconUrl,
    bannerUrl,
    host,
    isClosed,
    potionLevel,
  } = queueData;

  const currList = currentTurn || [];
  const waitList = waitingList || [];
  const totalInQueue = currList.length + waitList.length;
  const capacityStr =
    maxCapacity > 0 ? `${totalInQueue}/${maxCapacity}` : `${totalInQueue}`;

  let currentTurnText = "*(Nadie en turno)*";
  if (currList.length > 0) {
    const lines = currList.map((u) => {
      const timeTag = formatDiscordTimestamp(u.turnStartTime || u.joinedAt);
      const timeStr = timeTag ? ` (${timeTag})` : "";
      const noteStr = u.note ? ` [${u.note}]` : "";
      const name = u.displayName || u.username || u.id;
      return `> **@${name}**${noteStr}${timeStr}`;
    });
    currentTurnText = lines.join("\n");
  }

  let waitingListText = "*(Vacía)*";
  if (waitList.length > 0) {
    const lines = [];
    let totalChars = 0;
    let truncatedCount = 0;

    for (let i = 0; i < waitList.length; i++) {
      const u = waitList[i];
      const noteStr = u.note ? ` [${u.note}]` : "";
      const numStr = String(i + 1).padStart(2, "0");
      const timeTag = formatDiscordTimestamp(u.joinedAt);
      const timeStr = timeTag ? ` (${timeTag})` : "";
      const name = u.displayName || u.username || u.id;
      const line = `**${numStr}.** @${name}${noteStr}${timeStr}`;

      if (totalChars + line.length > 900 || lines.length >= 10) {
        truncatedCount = waitList.length - i;
        break;
      }
      lines.push(line);
      totalChars += line.length + 1;
    }

    if (truncatedCount > 0) {
      lines.push(`*... (+${truncatedCount} más en fila)*`);
    }
    waitingListText = lines.join("\n");
  }

  let historyText = "*(Sin turnos previos)*";
  if (pastTurns && pastTurns.length > 0) {
    const recent = pastTurns.slice(-8).reverse();
    const lines = recent.map((u) => {
      const timeTag = formatDiscordTimestamp(
        u.completedAt || u.turnStartTime || u.joinedAt,
      );
      const timeStr = timeTag ? ` (${timeTag})` : "";
      const noteStr = u.note ? ` [${u.note}]` : "";
      const name = u.displayName || u.username || u.id;
      return `• @${name}${noteStr}${timeStr}`;
    });
    historyText = lines.join("\n");
  }

  const potion = getPotionInfo(potionLevel);
  const potionPrefix = potion.badge ? `${potion.badge} ` : "";
  let statusBadge = isClosed ? "[CERRADA]" : " [ABIERTA]";

  const embed = new EmbedBuilder()
    .setTitle(
      `${potionPrefix}${title || "Cola de Turnos"} ${isClosed ? "[CERRADA]" : ""}`,
    )
    .setColor(isClosed ? "#ED4245" : potion.color);

  let desc = description || "";
  if (isClosed) {
    desc =
      `*[CERRADA] Cola cerrada temporalmente (Abre a las 18:00 hrs Chile o con /cola abrir).* \n${desc}`.trim();
  } else if (desc.trim().length > 0) {
    desc = `*${desc}*`;
  }

  if (desc.trim().length > 0) {
    embed.setDescription(desc);
  }

  if (iconUrl && iconUrl.startsWith("http")) {
    embed.setThumbnail(iconUrl);
  }

  if (bannerUrl && bannerUrl.startsWith("http")) {
    embed.setImage(bannerUrl);
  }

  embed.addFields(
    { name: "EN TURNO", value: currentTurnText, inline: false },
    {
      name: `EN COLA (${waitList.length})`,
      value: waitingListText,
      inline: true,
    },
    {
      name: `TURNOS PASADOS (${pastTurns?.length || 0})`,
      value: historyText,
      inline: true,
    },
  );

  if ((slotsPerTurn || 1) > 1) {
    embed.addFields({
      name: "POR TURNO",
      value: `${slotsPerTurn}`,
      inline: false,
    });
  }

  const cooldownSec =
    typeof queueData.advanceCooldown === "number"
      ? queueData.advanceCooldown
      : 60;
  const cooldownPart = cooldownSec > 0 ? ` • Cooldown: ${cooldownSec}s` : "";

  const advancePart = lastAdvancedBy
    ? `Último avance por: @${lastAdvancedBy.username}`
    : `Estado: ${statusBadge}`;
  const totalPart = `Total anotados: ${capacityStr}`;
  const hostPart = host ? ` • Organizador: ${host.username || host}` : "";
  let footerText = `${advancePart}${cooldownPart} • ${totalPart}${hostPart}`;

  if (pageInfo) {
    footerText += ` • [${pageInfo.current}/${pageInfo.total}]`;
  }

  embed.setFooter({ text: footerText });
  return embed;
}
