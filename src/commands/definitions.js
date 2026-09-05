import {
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
} from "discord.js";

/** Definición completa de los comandos slash del bot */
export const slashCommands = [
  new SlashCommandBuilder()
    .setName("cola")
    .setDescription("Gestiona colas de turnos y listas de espera")
    .addSubcommand((sub) =>
      sub
        .setName("crear")
        .setDescription("Crea una nueva cola independiente")
        .addStringOption((opt) =>
          opt
            .setName("titulo")
            .setDescription("Nombre o tema de la cola")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("nivel")
            .setDescription("Nivel de poción/mazmorra (20, 40, 60, ..., 200)")
            .setRequired(false)
            .addChoices(
              { name: "[Nivel 20]", value: 20 },
              { name: "[Nivel 40]", value: 40 },
              { name: "[Nivel 60]", value: 60 },
              { name: "[Nivel 80]", value: 80 },
              { name: "[Nivel 100]", value: 100 },
              { name: "[Nivel 120]", value: 120 },
              { name: "[Nivel 140]", value: 140 },
              { name: "[Nivel 160]", value: 160 },
              { name: "[Nivel 180]", value: 180 },
              { name: "[Nivel 200]", value: 200 },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("descripcion")
            .setDescription("Detalles o instrucciones adicionales")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("limite")
            .setDescription("Límite de personas (0 para sin límite)")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("por_turno")
            .setDescription("Cupos simultáneos por turno (por defecto 1)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("icono")
            .setDescription(
              "URL directa de la imagen/miniatura (ej: https://...png)",
            )
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("banner")
            .setDescription(
              "URL directa del banner inferior (ej: https://...png)",
            )
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("cooldown")
            .setDescription(
              "Segundos de enfriamiento global entre turnos (por defecto 60s, 0 para desactivar)",
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("mostrar")
        .setDescription(
          "Publica/reinvoca el mensaje interactivo público de una cola en el chat",
        )
        .addStringOption((opt) =>
          opt
            .setName("cola")
            .setDescription("Cola a mostrar en el canal")
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("editar")
        .setDescription(
          "Modifica el nombre, nivel, descripción, icono, banner o límite de una cola",
        )
        .addStringOption((opt) =>
          opt
            .setName("cola")
            .setDescription("Cola que deseas editar")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("titulo")
            .setDescription("Nuevo nombre o tema de la cola")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("nivel")
            .setDescription(
              "Nuevo nivel de poción/mazmorra (20 a 200, o 0 para quitar)",
            )
            .setRequired(false)
            .addChoices(
              { name: "[Nivel 20]", value: 20 },
              { name: "[Nivel 40]", value: 40 },
              { name: "[Nivel 60]", value: 60 },
              { name: "[Nivel 80]", value: 80 },
              { name: "[Nivel 100]", value: 100 },
              { name: "[Nivel 120]", value: 120 },
              { name: "[Nivel 140]", value: 140 },
              { name: "[Nivel 160]", value: 160 },
              { name: "[Nivel 180]", value: 180 },
              { name: "[Nivel 200]", value: 200 },
              { name: " Quitar nivel", value: 0 },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("descripcion")
            .setDescription("Nueva descripción")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("icono")
            .setDescription(
              'Nueva URL de la imagen/icono (o escribe "quitar" para borrarlo)',
            )
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("banner")
            .setDescription(
              'Nueva URL del banner inferior (o escribe "quitar" para borrarlo)',
            )
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("limite")
            .setDescription("Nuevo límite de personas (0 para sin límite)")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("por_turno")
            .setDescription("Nuevos cupos simultáneos por turno")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("cooldown")
            .setDescription(
              "Nuevos segundos de enfriamiento global entre turnos (ej: 60, o 0 para desactivar)",
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tarjeta")
        .setDescription(
          "Publica en el chat la tarjeta interactiva navegable ( ) visible para todos",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("listar")
        .setDescription("Abre tu visor personal privado de colas"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("siguiente")
        .setDescription("Pasa al siguiente participante en la cola")
        .addStringOption((opt) =>
          opt
            .setName("cola")
            .setDescription("ID o nombre de la cola (opcional si solo hay una)")
            .setAutocomplete(true)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("atras")
        .setDescription("Revierte el último turno si se avanzó por error")
        .addStringOption((opt) =>
          opt
            .setName("cola")
            .setDescription("ID o nombre de la cola (opcional si solo hay una)")
            .setAutocomplete(true)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription(
          "Limpia los turnos del día, vacía TODAS las colas y las deja cerradas para el siguiente ciclo",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("abrir")
        .setDescription(
          "Abre y reanuda las colas para permitir que los usuarios se unan",
        )
        .addStringOption((opt) =>
          opt
            .setName("cola")
            .setDescription(
              "Cola específica a abrir (deja vacío para abrir TODAS en este canal)",
            )
            .setAutocomplete(true)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("cerrar")
        .setDescription("Cierra las colas y vacía los participantes en espera")
        .addStringOption((opt) =>
          opt
            .setName("cola")
            .setDescription(
              "Cola específica a cerrar (deja vacío para cerrar TODAS)",
            )
            .setAutocomplete(true)
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("vaciar")
            .setDescription(
              "¿Vaciar también los turnos y la lista de espera? (Por defecto: Sí)",
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("vaciar")
        .setDescription(
          "Vacía la lista de espera y los turnos activos de las colas",
        )
        .addStringOption((opt) =>
          opt
            .setName("cola")
            .setDescription(
              "Cola específica a vaciar (deja vacío para vaciar TODAS)",
            )
            .setAutocomplete(true)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("limpiar")
        .setDescription(
          "Elimina mensajes ajenos de chat en este canal (mantiene intactos los paneles de cola)",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("eliminar")
        .setDescription(
          "Elimina permanentemente una cola y borra su mensaje del canal",
        )
        .addStringOption((opt) =>
          opt
            .setName("cola")
            .setDescription("Cola que deseas eliminar permanentemente")
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("mover")
        .setDescription("Mueve (corta y pega) una cola a otro canal de texto")
        .addChannelOption((opt) =>
          opt
            .setName("canal")
            .setDescription("Canal de destino donde deseas trasladar la cola")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
            )
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("cola")
            .setDescription(
              "Cola a mover (opcional si solo hay una en este canal)",
            )
            .setAutocomplete(true)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("insertar")
        .setDescription(
          "Inserta a un usuario en una posición específica de la cola (desplaza a los demás)",
        )
        .addUserOption((opt) =>
          opt
            .setName("usuario")
            .setDescription("Usuario que deseas insertar en la cola")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("posicion")
            .setDescription(
              "Puesto/número en la fila donde quieres colocarlo (ej: 1 para el primer lugar en espera)",
            )
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("cola")
            .setDescription("Cola a modificar (opcional si solo hay una)")
            .setAutocomplete(true)
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("nota")
            .setDescription("Nota o motivo opcional (ej: AFK recuperado, DC)")
            .setRequired(false),
        ),
    ),
].map((cmd) => cmd.toJSON());

/** Registra los comandos slash en la API de Discord */
export async function registerSlashCommands(client) {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log(" Registrando comandos Slash (/cola)...");
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: slashCommands,
    });
    console.log(" Comandos Slash registrados con éxito en Discord.");
  } catch (err) {
    console.error(" Error registrando comandos Slash:", err);
  }
}
