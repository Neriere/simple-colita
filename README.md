# Manual de Uso: Bot de Colas para Discord

Guía directa de comandos y funciones del bot.

---

## 1. Botones del Panel de Cola

Los usuarios interactúan directamente con los botones en el mensaje de la cola:

* **Unirse:** Ingresa a la cola. Si hay cupos disponibles, pasa de inmediato a "EN TURNO". De lo contrario, queda en "EN COLA".
* **Salir:** Retira al usuario de la lista de espera o del turno activo.
* **Siguiente:** Finaliza el turno actual y avanza a los siguientes participantes en espera.
* **Atras:** Revierte el último turno si se avanzó por error.

---

## 2. Comandos Slash (`/cola`)

### Creación y Visualización

* `/cola crear`
  * Parámetros: `titulo` (obligatorio), `descripcion`, `limite`, `por_turno`, `icono`, `banner`.
  * Función: Crea una nueva cola en el canal actual y publica el panel interactivo.

* `/cola mostrar`
  * Parámetros: `cola` (obligatorio).
  * Función: Vuelve a publicar el panel de una cola al final del chat para que quede visible.

* `/cola tarjeta`
  * Función: Publica una tarjeta interactiva navegable para consultar todas las colas del canal.

* `/cola listar`
  * Función: Muestra un menú privado e individual con el estado de las colas.

---

### Gestión de Turnos

* `/cola siguiente`
  * Parámetros: `cola` (opcional).
  * Función: Hace avanzar el turno de la cola indicada o de la única activa en el canal.

* `/cola atras`
  * Parámetros: `cola` (opcional).
  * Función: Revierte el último avance y restaura a los usuarios previos.

* `/cola insertar`
  * Parámetros: `usuario` (obligatorio), `posicion` (obligatorio), `cola` (opcional), `nota` (opcional).
  * Función: Coloca a un usuario en una posición específica de la fila (ej: posición 1) y desplaza al resto hacia atrás.

---

### Control, Estado y Limpieza

* `/cola abrir`
  * Parámetros: `cola` (opcional).
  * Función: Abre la recepción de participantes en una cola específica o en todas las del canal.

* `/cola cerrar`
  * Parámetros: `cola` (opcional), `vaciar` (opcional, Sí por defecto).
  * Función: Cierra la cola para impedir nuevos ingresos y, por defecto, vacía los turnos y la lista de espera.

* `/cola vaciar`
  * Parámetros: `cola` (opcional).
  * Función: Borra los turnos activos y la lista de espera sin cerrar la cola.

* `/cola reset`
  * Función: Limpia turnos activos, listas de espera e historial de todas las colas, dejándolas cerradas para el siguiente ciclo.

* `/cola limpiar`
  * Función: Borra los mensajes de texto enviados por usuarios en el canal para mantener el chat despejado. No borra los paneles de cola ni mensajes anclados.

* `/cola editar`
  * Parámetros: `cola` (obligatorio), `titulo`, `descripcion`, `limite`, `por_turno`, `icono`, `banner`.
  * Función: Modifica la configuración de una cola existente. Para quitar icono o banner, escribe la palabra "quitar".

* `/cola eliminar`
  * Parámetros: `cola` (obligatorio).
  * Función: Elimina la cola de forma permanente y borra su panel del canal.

---

## 3. Automatización de Horarios

* **Apertura automática:** Todos los días a las 18:00 (Hora de Chile / America/Santiago), el bot abre automáticamente todas las colas activas del servidor.
* **Auto-eliminación de avisos:** Las confirmaciones de comandos se borran automáticamente a los 10 segundos para no ensuciar el canal.

