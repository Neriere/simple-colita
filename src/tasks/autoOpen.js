import { queues, saveQueues } from "../storage/queueStore.js";
import { resolveChannel } from "../utils/discordUtils.js";
import { updateQueueMessage } from "../services/queueService.js";

/** Inicia el cron de auto-apertura a las 18:00 hrs de Chile (America/Santiago). */
export function startAutoOpenTask(client) {
  let lastAutoOpenedDay = "";

  setInterval(async () => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("es-CL", {
        timeZone: "America/Santiago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const day = parts.find((p) => p.type === "day")?.value || "";
      const month = parts.find((p) => p.type === "month")?.value || "";
      const year = parts.find((p) => p.type === "year")?.value || "";
      const hour = parseInt(
        parts.find((p) => p.type === "hour")?.value || "0",
        10,
      );
      const minute = parseInt(
        parts.find((p) => p.type === "minute")?.value || "0",
        10,
      );

      const todayKey = `${year}-${month}-${day}`;

      if (hour >= 18 && lastAutoOpenedDay !== todayKey) {
        lastAutoOpenedDay = todayKey;
        console.log(
          ` [AUTO-APERTURA] Son las ${hour}:${String(minute).padStart(2, "0")} hrs (Chile). Reanudando y abriendo todas las colas activas...`,
        );

        for (const q of queues.values()) {
          q.isClosed = false;
        }
        saveQueues();

        const queueList = Array.from(queues.values());
        await Promise.allSettled(
          queueList.map(async (q) => {
            try {
              const chan = await resolveChannel(client, q.channelId, null);
              if (chan) {
                await updateQueueMessage(client, q, chan);
              }
            } catch (err) {
              console.error(
                `[AUTO-APERTURA] Error al actualizar cola "${q.title}":`,
                err,
              );
            }
          }),
        );
        console.log(
          ` [AUTO-APERTURA] Se abrieron con éxito ${queueList.length} cola(s).`,
        );
      }
    } catch (e) {
      console.error("Error en cron de auto-apertura:", e);
    }
  }, 15 * 1000);
}
