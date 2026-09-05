import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, "../../");

export const DATA_FILE = path.join(ROOT_DIR, "queues.json");
export const LEGACY_DATA_FILE = path.join(ROOT_DIR, "queues_data.json");

/**
 * Retorna badge y color asociado al nivel de poción / mazmorra.
 * @param {number|string|null} potionLevel
 */
export function getPotionInfo(potionLevel) {
  if (!potionLevel) return { badge: "", color: "#2B2D31", name: "" };
  const lvl = Number(potionLevel);
  if (lvl <= 60) {
    return {
      badge: ` [Lv. ${lvl}]`,
      color: "#57F287",
      name: `Poción Nivel ${lvl}`,
    };
  }
  if (lvl <= 100) {
    return {
      badge: ` [Lv. ${lvl}]`,
      color: "#5865F2",
      name: `Poción Nivel ${lvl}`,
    };
  }
  if (lvl <= 160) {
    return {
      badge: ` [Lv. ${lvl}]`,
      color: "#FEE75C",
      name: `Poción Nivel ${lvl}`,
    };
  }
  return {
    badge: ` [Lv. ${lvl}]`,
    color: "#EB459E",
    name: `Poción Nivel ${lvl}`,
  };
}

/**
 * Obtiene la hora actual en zona horaria de Chile (America/Santiago).
 */
export function getChileCurrentHour() {
  try {
    const formatter = new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === "hour");
    return parseInt(hourPart.value, 10);
  } catch {
    return new Date().getHours();
  }
}

/**
 * Cooldown global por defecto (en segundos) para evitar que varias personas
 * salten de turno consecutivamente y se salten el turno a alguien.
 */
export const DEFAULT_ADVANCE_COOLDOWN_SECONDS = 60;

