import { MessageFlags } from "discord.js";

// Subcomandos modulares desacoplados
import { handleCrear } from "./subcommands/crear.js";
import { handleMostrar } from "./subcommands/mostrar.js";
import { handleEditar } from "./subcommands/editar.js";
import { handleTarjeta } from "./subcommands/tarjeta.js";
import { handleListar } from "./subcommands/listar.js";
import { handleSiguiente } from "./subcommands/siguiente.js";
import { handleAtras } from "./subcommands/atras.js";
import { handleReset } from "./subcommands/reset.js";
import { handleAbrir } from "./subcommands/abrir.js";
import { handleCerrar } from "./subcommands/cerrar.js";
import { handleVaciar } from "./subcommands/vaciar.js";
import { handleLimpiar } from "./subcommands/limpiar.js";
import { handleEliminar } from "./subcommands/eliminar.js";
import { handleMover } from "./subcommands/mover.js";
import { handleInsertar } from "./subcommands/insertar.js";

/**
 * Tabla de despacho (Dispatcher Map) para ejecución en O(1) sin cascada de ifs.
 */
const subcommandHandlers = new Map([
  ["crear", handleCrear],
  ["mostrar", handleMostrar],
  ["editar", handleEditar],
  ["tarjeta", handleTarjeta],
  ["listar", handleListar],
  ["siguiente", handleSiguiente],
  ["atras", handleAtras],
  ["reset", handleReset],
  ["abrir", handleAbrir],
  ["cerrar", handleCerrar],
  ["vaciar", handleVaciar],
  ["limpiar", handleLimpiar],
  ["eliminar", handleEliminar],
  ["mover", handleMover],
  ["insertar", handleInsertar],
]);

/**
 * Manejador principal para comandos Slash (/cola).
 * Despacha directamente al subcomando correspondiente.
 */
export async function handleSlashCommand(interaction, client) {
  if (interaction.commandName !== "cola") return;

  const subcommand = interaction.options.getSubcommand();
  const handler = subcommandHandlers.get(subcommand);

  if (!handler) {
    return interaction.reply({
      content: `El subcomando \`${subcommand}\` no está implementado o no fue reconocido.`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  try {
    return await handler(interaction, client);
  } catch (error) {
    console.error(`Error ejecutando subcomando /cola ${subcommand}:`, error);
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: `Ocurrió un error inesperado al procesar el comando: \`${error.message}\``,
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}
