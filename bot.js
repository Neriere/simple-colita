import { Client, GatewayIntentBits, MessageFlags } from "discord.js";
import dotenv from "dotenv";
dotenv.config({ override: true });

// Módulos internos organizados
import { queues, loadQueues } from "./src/storage/queueStore.js";
import { registerSlashCommands } from "./src/commands/definitions.js";
import { handleSlashCommand } from "./src/commands/slashHandler.js";
import { handleButtonInteraction } from "./src/interactions/buttonHandler.js";
import { handleSelectMenuInteraction } from "./src/interactions/selectHandler.js";
import { handleAutocompleteInteraction } from "./src/interactions/autocompleteHandler.js";
import { startAutoOpenTask } from "./src/tasks/autoOpen.js";
import { startHealthCheckServer, botState } from "./src/server.js";

// Manejo preventivo de excepciones globales
process.on("unhandledRejection", (reason) => {
  console.error(" [WARNING] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err, origin) => {
  console.error(" [ERROR] Uncaught Exception:", err, origin);
});

// Inicialización del cliente de Discord con los intents requeridos
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.on("error", (err) => {
  console.error(" [DISCORD CLIENT ERROR]:", err);
});

// Evento cuando el bot inicia sesión correctamente
client.once("clientReady", async () => {
  botState.isOnline = true;
  botState.userTag = client.user.tag;
  botState.userId = client.user.id;
  botState.loginError = null;

  console.log(`==============================================`);
  console.log(` Bot ONLINE y conectado como: ${client.user.tag}`);
  console.log(`==============================================`);

  // 1. Cargar base de datos de colas
  loadQueues();

  // 2. Registrar comandos Slash (/cola)
  await registerSlashCommands(client);

  // 3. Iniciar cron de auto-apertura a las 18:00 hrs de Chile
  startAutoOpenTask(client);
});

// Enrutador central de interacciones de Discord
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      return await handleAutocompleteInteraction(interaction);
    }

    if (interaction.isChatInputCommand()) {
      return await handleSlashCommand(interaction, client);
    }

    if (interaction.isStringSelectMenu()) {
      return await handleSelectMenuInteraction(interaction, client);
    }

    if (interaction.isButton()) {
      return await handleButtonInteraction(interaction, client);
    }
  } catch (err) {
    console.error(" Error en el enrutador de interacciones:", err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Ocurrió un error temporal al procesar la acción.",
          flags: [MessageFlags.Ephemeral],
        });
      }
    } catch {}
  }
});

// Cargar estado inicial de colas
loadQueues();

// Iniciar servidor HTTP para health check (Puerto 3000)
startHealthCheckServer(client, queues, 3000);

// Iniciar sesión en Discord con manejo preventivo de tokens no válidos
const rawToken = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : "";

if (rawToken.length > 0) {
  botState.loginAttemptedAt = new Date().toISOString();

  client
    .login(rawToken)
    .then(() => {
      botState.isOnline = true;
      botState.loginError = null;
    })
    .catch((err) => {
      botState.isOnline = false;
      botState.loginError = err.message || "Error al conectar con Discord";

      console.warn(`\n[DISCORD] ⚠️ Aviso de conexión: ${err.message}`);
      if (err.message.includes("An invalid token was provided")) {
        console.warn(
          "[DISCORD] 👉 El token actual no es válido o fue revocado en Discord Developer Portal.",
        );
        console.warn(
          "[DISCORD] 👉 Pasos para resolverlo: Ve a https://discord.com/developers/applications -> Tu Bot -> Pestaña 'Bot' -> 'Reset Token' y actualiza DISCORD_TOKEN.\n",
        );
      }
    });
} else {
  botState.isOnline = false;
  botState.loginError = "Variable DISCORD_TOKEN no configurada.";
  console.log(
    "[DISCORD] DISCORD_TOKEN no detectado en variables de entorno. Configúralo para conectar el bot.",
  );
}
