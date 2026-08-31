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
| `/cola eliminar` | Borra permanentemente una cola y su panel |
| `/cola reset` | Limpia turnos y prepara las colas para el siguiente ciclo |
| `/cola insertar` | Inserta a un usuario en una posicion especifica |

---

## Estructura del Proyecto

```text
├── bot.js          # Codigo principal del bot de Discord
├── package.json    # Configuracion de dependencias y scripts de Node.js
├── .env.example    # Plantilla de variables de entorno
├── .gitignore      # Archivos ignorados por Git
└── README.md       # Documentacion y guia de despliegue
```
