# Discord Queue Bot (Simple Colita)

Bot de Discord enfocado en la gestion agil e interactiva de colas y turnos para servidores de Discord (ideal para mazmorras, pociones, eventos o listas de espera).

Optimizado para ejecutarse en entornos **Node.js** puros sin sobrecarga de archivos web o dependencias innecesarias.

---

## Requisitos

- **Node.js**: v18.0.0 o superior
- **Token de Discord Bot**: Obtenido desde el [Discord Developer Portal](https://discord.com/developers/applications) con los intents de mensajes y guilds activados.

---

## Instalacion

1. Clona el repositorio o sube los archivos a tu hosting:
   ```bash
   git clone https://github.com/Neriere/simple-colita.git
   cd simple-colita
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura tu token en `.env`:
   ```bash
   cp .env.example .env
   ```
   Edita `.env` y agrega tu token:
   ```env
   DISCORD_TOKEN=tu_token_aqui
   ```

4. Inicia el bot:
   ```bash
   npm start
   ```

---

## Comandos Slash Disponibles

| Comando | Descripcion |
| :--- | :--- |
| `/cola crear` | Crea un nuevo panel interactivo de cola en el canal |
| `/cola mostrar` | Vuelve a enviar el panel interactivo de una cola |
| `/cola editar` | Modifica titulo, color, roles permitidos, notas o imagenes |
| `/cola tarjeta` | Abre el visor navegable con paginacion de colas |
| `/cola listar` | Lista todas las colas configuradas en el servidor |
| `/cola siguiente` | Avanza el turno al siguiente usuario en la cola |
| `/cola atras` | Revierte el ultimo avance y restaura la posicion |
| `/cola abrir` | Abre o reanuda las colas |
| `/cola cerrar` | Cierra las colas para evitar nuevos ingresos |
| `/cola vaciar` | Vacia la lista de espera de la cola |
| `/cola limpiar` | Elimina mensajes ajenos en el canal de la cola |
| `/cola mover` | Traslada (corta y pega) una cola a otro canal de texto sin perder participantes |
| `/cola eliminar` | Borra permanentemente una cola y su panel |
| `/cola reset` | Limpia turnos y prepara las colas para el siguiente ciclo |
| `/cola insertar` | Inserta a un usuario en una posicion especifica |

---

## Estructura Modular del Proyecto

El bot cuenta con una arquitectura desacoplada y modular para facilitar su mantenimiento y evolución:

```text
simple-colita/
├── bot.js                          # Punto de entrada principal (orquestador ~80 líneas)
├── package.json                    # Dependencias y scripts de ejecución
├── .env.example                    # Plantilla de variables de entorno
├── .gitignore                      # Reglas de exclusión para Git
├── README.md                       # Documentación del proyecto
└── src/
    ├── config/
    │   └── constants.js            # Niveles de pociones, colores y zona horaria (Chile)
    ├── storage/
    │   └── queueStore.js           # Base de datos en memoria y persistencia (queues.json)
    ├── utils/
    │   └── discordUtils.js         # Utilidades (timestamps nativos, resolución de canales, limpieza)
    ├── ui/
    │   ├── queueEmbed.js           # Constructor de Embeds visuales de las colas
    │   └── queueComponents.js      # Botones interactivos, paginación y menús de selección
    ├── services/
    │   └── queueService.js         # Lógica central: avance, deshacer turno, DMs y avisos
    ├── commands/
    │   ├── definitions.js          # Definición y registro de comandos Slash (/cola)
    │   └── slashHandler.js         # Ejecución de todos los subcomandos de /cola
    ├── interactions/
    │   ├── buttonHandler.js        # Manejador de botones (Unirse, Salir, Siguiente, Atrás)
    │   ├── selectHandler.js        # Manejador de selecciones de tarjeta y asignación de nivel
    │   └── autocompleteHandler.js  # Autocompletado rápido de colas en comandos slash
    ├── tasks/
    │   └── autoOpen.js             # Tarea programada (apertura automática 18:00 hrs Chile)
    └── server.js                   # Servidor HTTP en puerto 3000 para health check
```

---

## Compatibilidad con Bot Hosting (Pterodactyl / Bot-Hosting.net)

En paneles de Bot Hosting:
- **ENTRY FILE (STARTUP_FILE)**: `bot.js`
- **START COMMAND**: `exec node ${STARTUP_FILE}`

No necesitas cambiar ningún parámetro en tu panel. `bot.js` se ubica en la raíz del proyecto y se encarga de cargar transparentemente todos los submódulos de la carpeta `src/`. Al actualizar tu bot en el hosting, solo necesitas hacer:

```bash
git pull
# Luego reiniciar el contenedor desde el panel
```

