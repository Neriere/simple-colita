import fs from "fs";
import path from "path";
import { DATA_FILE, LEGACY_DATA_FILE } from "../config/constants.js";
import { PermissionFlagsBits } from "discord.js";

/** Map en memoria con todas las colas activas indexadas por ID */
export const queues = new Map();

/** Carga las colas guardadas desde el archivo de persistencia */
export function loadQueues() {
  try {
    const fileToLoad = fs.existsSync(DATA_FILE)
      ? DATA_FILE
      : fs.existsSync(LEGACY_DATA_FILE)
        ? LEGACY_DATA_FILE
        : null;

    if (fileToLoad) {
      const data = JSON.parse(fs.readFileSync(fileToLoad, "utf8"));
      queues.clear();
      for (const [k, v] of Object.entries(data)) {
        queues.set(k, v);
      }
      console.log(
        ` [DATA] Se cargaron ${queues.size} colas desde ${path.basename(fileToLoad)}.`,
      );

      if (fileToLoad === LEGACY_DATA_FILE && !fs.existsSync(DATA_FILE)) {
        saveQueues();
      }
    }
  } catch (err) {
    console.error(" Error leyendo archivo de colas:", err);
  }
}

/** Guarda el estado actual de las colas en disco */
export function saveQueues() {
  try {
    const obj = {};
    for (const [k, v] of queues.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (err) {
    console.error(" Error guardando queues.json:", err);
  }
}

/** Retorna todas las colas configuradas en un canal específico, ordenadas por fecha */
export function getQueuesInChannel(channelId) {
  const list = [];
  for (const q of queues.values()) {
    if (q.channelId === channelId) list.push(q);
  }
  return list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Valida si un miembro tiene permisos para administrar la cola */
export function canManageQueue(queueData, interaction) {
  if (!queueData) return false;
  if (queueData.hostId === interaction.user.id) return true;

  const perms =
    interaction.memberPermissions || interaction.member?.permissions;
  if (perms) {
    if (perms.has(PermissionFlagsBits.Administrator)) return true;
    if (perms.has(PermissionFlagsBits.ManageGuild)) return true;
    if (perms.has(PermissionFlagsBits.ManageMessages)) return true;
    if (perms.has(PermissionFlagsBits.ManageChannels)) return true;
  }
  return false;
}
