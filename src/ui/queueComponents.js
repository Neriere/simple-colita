import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

/** Genera los botones de interacción para el panel individual de la cola. */
export function buildQueueButtons(queueId, isClosed = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_join:${queueId}`)
      .setLabel("Unirse")
      .setStyle(ButtonStyle.Success)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_leave:${queueId}`)
      .setLabel("Salir")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_next:${queueId}`)
      .setLabel("Siguiente")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_undo:${queueId}`)
      .setLabel("Atrás")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed),
  );

  return [row];
}

/** Genera los componentes del visor interactivo de tarjetas con paginación y salto directo. */
export function buildCardViewerComponents(activeQueues, currentIndex) {
  const total = activeQueues.length;
  if (total === 0) return [];

  const safeIndex = Math.max(0, Math.min(currentIndex, total - 1));
  const currentQueue = activeQueues[safeIndex];
  const queueId = currentQueue.id;
  const isClosed = !!currentQueue.isClosed;

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`card_nav:first:${safeIndex}`)
      .setLabel("|<")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safeIndex === 0),
    new ButtonBuilder()
      .setCustomId(`card_nav:prev:${safeIndex}`)
      .setLabel("< Anterior")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(safeIndex === 0),
    new ButtonBuilder()
      .setCustomId(`card_nav:count:${safeIndex}`)
      .setLabel(`${safeIndex + 1} / ${total}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`card_nav:next:${safeIndex}`)
      .setLabel("Siguiente >")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(safeIndex >= total - 1),
    new ButtonBuilder()
      .setCustomId(`card_nav:last:${safeIndex}`)
      .setLabel(">|")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safeIndex >= total - 1),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_join:${queueId}`)
      .setLabel("Unirme a esta")
      .setStyle(ButtonStyle.Success)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_leave:${queueId}`)
      .setLabel("Salir")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_next:${queueId}`)
      .setLabel("Siguiente")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`btn_setlvl_menu:${queueId}`)
      .setLabel(
        currentQueue.potionLevel
          ? `Lv. ${currentQueue.potionLevel}`
          : "Asignar Nivel",
      )
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn_hide:${queueId}`)
      .setLabel("Ocultar")
      .setStyle(ButtonStyle.Secondary),
  );

  const pageSize = 23;
  let selectOptions = [];

  if (total <= 25) {
    selectOptions = activeQueues.map((q, idx) => {
      const count = (q.currentTurn?.length || 0) + (q.waitingList?.length || 0);
      const lock = q.isClosed ? "[CERRADA] " : "";
      const lvlTag = q.potionLevel ? `[Lv. ${q.potionLevel}] ` : "";
      return new StringSelectMenuOptionBuilder()
        .setLabel(
          `${idx + 1}. ${lock}${lvlTag}${q.title.length > 70 ? q.title.substring(0, 67) + "..." : q.title}`,
        )
        .setDescription(
          ` Total: ${count} | Turno: ${q.currentTurn?.length || 0} | Cola: ${q.waitingList?.length || 0}`,
        )
        .setValue(String(idx))
        .setDefault(idx === safeIndex);
    });
  } else {
    const currentChunkPage = Math.floor(safeIndex / pageSize);
    const totalChunkPages = Math.ceil(total / pageSize);
    const startIdx = currentChunkPage * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);

    if (currentChunkPage > 0) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(
            ` Ver anteriores colas (Pág. ${currentChunkPage}/${totalChunkPages})`,
          )
          .setDescription(`Volver a las colas 1 - ${startIdx}`)
          .setValue(`page_jump:${startIdx - pageSize}`),
      );
    }

    for (let idx = startIdx; idx < endIdx; idx++) {
      const q = activeQueues[idx];
      const count = (q.currentTurn?.length || 0) + (q.waitingList?.length || 0);
      const lock = q.isClosed ? "[CERRADA] " : "";
      const lvlTag = q.potionLevel ? `[Lv. ${q.potionLevel}] ` : "";
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(
            `${idx + 1}. ${lock}${lvlTag}${q.title.length > 70 ? q.title.substring(0, 67) + "..." : q.title}`,
          )
          .setDescription(
            ` Total: ${count} | Turno: ${q.currentTurn?.length || 0} | Cola: ${q.waitingList?.length || 0}`,
          )
          .setValue(String(idx))
          .setDefault(idx === safeIndex),
      );
    }

    if (endIdx < total) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(
            ` Ver más colas (Pág. ${currentChunkPage + 2}/${totalChunkPages})`,
          )
          .setDescription(
            `Ver colas ${endIdx + 1} a ${Math.min(endIdx + pageSize, total)}`,
          )
          .setValue(`page_jump:${endIdx}`),
      );
    }
  }

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("card_select_jump")
      .setPlaceholder(" Saltar directamente a una cola...")
      .addOptions(selectOptions),
  );

  return [navRow, actionRow, selectRow];
}

/** Genera el menú desplegable para asignar nivel de poción / mazmorra. */
export function buildLevelSelectMenu(queueData) {
  const levelOptions = [
    {
      label: "Poción Nivel 20 (Inicial)",
      value: "20",
      description: "Para recaudadores en zonas lvl 20",
    },
    {
      label: "Poción Nivel 40",
      value: "40",
      description: "Para recaudadores en zonas lvl 40",
    },
    {
      label: "Poción Nivel 60",
      value: "60",
      description: "Para recaudadores en zonas lvl 60",
    },
    {
      label: "Poción Nivel 80",
      value: "80",
      description: "Para recaudadores en zonas lvl 80",
    },
    {
      label: "Poción Nivel 100 (Intermedio)",
      value: "100",
      description: "Para recaudadores en zonas lvl 100",
    },
    {
      label: "Poción Nivel 120",
      value: "120",
      description: "Para recaudadores en zonas lvl 120",
    },
    {
      label: "Poción Nivel 140",
      value: "140",
      description: "Para recaudadores en zonas lvl 140",
    },
    {
      label: "Poción Nivel 160 (Alto)",
      value: "160",
      description: "Para recaudadores en zonas lvl 160",
    },
    {
      label: "Poción Nivel 180 (Endgame)",
      value: "180",
      description: "Para recaudadores en zonas lvl 180",
    },
    {
      label: "Poción Nivel 200 (Épico)",
      value: "200",
      description: "Para recaudadores en mazmorras y zonas lvl 200",
    },
    {
      label: " Quitar Nivel / Sin Nivel",
      value: "0",
      description: "Restablece la cola a formato general",
    },
  ].map((opt) => {
    const isDef = (queueData.potionLevel || 0) === parseInt(opt.value, 10);
    return new StringSelectMenuOptionBuilder()
      .setLabel(opt.label)
      .setValue(opt.value)
      .setDescription(opt.description)
      .setDefault(isDef);
  });

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`select_set_potion:${queueData.id}`)
      .setPlaceholder(" Elige el nivel de la poción / mazmorra...")
      .addOptions(levelOptions),
  );
}
