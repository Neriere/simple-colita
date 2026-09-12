import http from "http";
import { saveQueues } from "./storage/queueStore.js";

/**
 * Estado en tiempo de ejecución del bot de Discord
 */
export const botState = {
  isOnline: false,
  userTag: null,
  userId: null,
  loginError: null,
  loginAttemptedAt: null,
  startedAt: new Date().toISOString(),
};

/**
 * Servidor HTTP de mantenimiento y health check para entornos cloud y bot hosting.
 * Responde en el puerto 3000 tanto con JSON para health checks automatizados
 * como con una vista HTML informativa de estado.
 */
export function startHealthCheckServer(client, queues, port = 3000) {
  const server = http.createServer((req, res) => {
    // Endpoint para eliminar una cola directamente desde la UI web
    if (req.method === "DELETE" && req.url.startsWith("/api/queues/")) {
      const queueId = decodeURIComponent(req.url.replace("/api/queues/", "").trim());
      if (queues.has(queueId)) {
        const deletedQueue = queues.get(queueId);
        queues.delete(queueId);
        saveQueues();
        console.log(`[API] Cola eliminada manualmente: ${queueId} (${deletedQueue.title})`);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ success: true, deletedId: queueId, remaining: queues.size }));
      } else {
        res.writeHead(404, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ error: "Cola no encontrada" }));
      }
      return;
    }

    // Endpoint para obtener todas las colas en formato JSON
    if (req.url === "/api/queues" || req.url === "/queues.json") {
      const obj = {};
      for (const [k, v] of queues.entries()) {
        obj[k] = v;
      }
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify(obj, null, 2));
      return;
    }

    const isJsonRequest =
      req.url === "/health" ||
      req.url === "/api/health" ||
      (req.headers.accept && req.headers.accept.includes("application/json") && !req.headers.accept.includes("text/html"));

    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeFormatted = formatUptime(uptimeSeconds);

    if (isJsonRequest) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          botOnline: Boolean(client.user && botState.isOnline),
          userTag: client.user ? client.user.tag : null,
          loginError: botState.loginError,
          uptime: uptimeSeconds,
          queuesCount: queues.size,
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    // Preparar lista de colas para la previsualización interactiva
    const queuesArray = Array.from(queues.values());
    const isOnline = Boolean(client.user && botState.isOnline);
    const queuesJsonSafe = JSON.stringify(queuesArray).replace(/</g, "\\u003c");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Perceptor Queue Bot - Explorador de Colas</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #151d30;
      --card-hover: #1c2742;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --border: #24324f;
      --accent: #5865f2;
      --success: #22c55e;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      padding: 24px 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header-panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .title-group {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .logo-badge {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #5865f2, #3b82f6);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);
    }
    h1 { font-size: 22px; font-weight: 700; color: #fff; }
    .subtitle { font-size: 13px; color: var(--muted); margin-top: 2px; }
    .stats-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .stat-pill {
      background: rgba(11, 15, 25, 0.7);
      border: 1px solid var(--border);
      padding: 8px 14px;
      border-radius: 9999px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stat-pill strong { color: #fff; }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${isOnline ? "var(--success)" : "var(--warning)"};
      box-shadow: 0 0 8px ${isOnline ? "var(--success)" : "var(--warning)"};
    }
    .toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .search-input {
      flex: 1;
      min-width: 240px;
      background: var(--card);
      border: 1px solid var(--border);
      color: #fff;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus { border-color: var(--accent); }
    .filter-btn {
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--muted);
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    .filter-btn.active, .filter-btn:hover {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    .download-btn {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #86efac;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 13px;
      text-decoration: none;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .download-btn:hover { background: rgba(34, 197, 94, 0.25); }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
    }
    .queue-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      display: flex;
      gap: 16px;
      transition: transform 0.15s, border-color 0.15s;
    }
    .queue-card:hover {
      border-color: #3b82f6;
      transform: translateY(-2px);
      background: var(--card-hover);
    }
    .queue-avatar {
      width: 64px;
      height: 64px;
      border-radius: 10px;
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .queue-avatar img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .queue-avatar-placeholder {
      font-size: 24px;
      color: var(--muted);
    }
    .queue-body {
      flex: 1;
      min-width: 0;
    }
    .queue-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .level-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(88, 101, 242, 0.2);
      color: #a5b4fc;
      border: 1px solid rgba(88, 101, 242, 0.4);
      white-space: nowrap;
    }
    .level-high {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.4);
    }
    .level-mid {
      background: rgba(245, 158, 11, 0.2);
      color: #fde68a;
      border-color: rgba(245, 158, 11, 0.4);
    }
    .level-low {
      background: rgba(34, 197, 94, 0.2);
      color: #86efac;
      border-color: rgba(34, 197, 94, 0.4);
    }
    .queue-title {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .queue-desc {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.4;
      margin-bottom: 10px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .queue-meta-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .chip {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(0,0,0,0.3);
      color: #cbd5e1;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .chip-shared {
      background: rgba(168, 85, 247, 0.15);
      color: #d8b4fe;
      border-color: rgba(168, 85, 247, 0.3);
    }
    .chip-open {
      background: rgba(59, 130, 246, 0.15);
      color: #93c5fd;
      border-color: rgba(59, 130, 246, 0.3);
    }
    .delete-btn {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
      margin-left: auto;
      transition: all 0.15s;
    }
    .delete-btn:hover {
      background: rgba(239, 68, 68, 0.35);
      color: #fff;
      border-color: rgba(239, 68, 68, 0.6);
    }
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal-overlay.active { display: flex; }
    .modal-card {
      background: #1e293b;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .modal-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal-desc {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .modal-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .btn-secondary {
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--border);
      color: #cbd5e1;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
    }
    .btn-danger {
      background: #ef4444;
      border: 1px solid #dc2626;
      color: #fff;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-danger:hover { background: #dc2626; }
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1e293b;
      border: 1px solid var(--accent);
      color: #fff;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 13px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
      display: none;
      z-index: 1001;
    }
    #countIndicator {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-panel">
      <div class="title-group">
        <div class="logo-badge">⚔️</div>
        <div>
          <h1>Perceptor Queue Bot</h1>
          <p class="subtitle">Base de Datos DofusDB y Gestor de Colas de Recaudadores</p>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-pill">
          <div class="status-dot"></div>
          <span>${isOnline ? "Bot Online" : "Servidor Web Listo"}</span>
        </div>
        <div class="stat-pill">
          <span>Colas Totales: <strong id="totalQueuesCount">${queuesArray.length}</strong></span>
        </div>
        <a href="/api/queues" target="_blank" class="download-btn">
          ⬇️ Ver / Descargar queues.json
        </a>
      </div>
    </div>

    <div class="toolbar">
      <input type="text" id="searchInput" class="search-input" placeholder="Buscar por mazmorra, zona o jefe (ej. Dragocerdo, Frigost, Cania, Jalamut)...">
      <button class="filter-btn active" data-filter="all">Todas (${queuesArray.length})</button>
      <button class="filter-btn" data-filter="shared">Zona + Mazmorra</button>
      <button class="filter-btn" data-filter="open">Zonas Abiertas</button>
      <button class="filter-btn" data-filter="lvl200">Nivel 180-200</button>
    </div>

    <div id="countIndicator">Mostrando todas las colas...</div>
    <div class="cards-grid" id="cardsGrid"></div>
  </div>

  <div id="confirmModal" class="modal-overlay">
    <div class="modal-card">
      <div class="modal-title"><span>🗑️</span> Confirmar Eliminación</div>
      <p class="modal-desc" id="modalPromptText">¿Deseas eliminar esta cola de recaudador?</p>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" id="modalCancelBtn">Cancelar</button>
        <button type="button" class="btn-danger" id="modalConfirmBtn">Eliminar Definitivamente</button>
      </div>
    </div>
  </div>

  <div id="toastNotification" class="toast"></div>

  <script>
    const allQueues = ${queuesJsonSafe};
    let currentFilter = "all";
    let searchDebounce = null;

    function getLevelClass(lvl) {
      if (!lvl) return "";
      if (lvl >= 180) return "level-high";
      if (lvl >= 100) return "level-mid";
      return "level-low";
    }

    function renderCards() {
      const query = document.getElementById("searchInput").value.trim().toLowerCase();
      const grid = document.getElementById("cardsGrid");
      const indicator = document.getElementById("countIndicator");

      const filtered = allQueues.filter(q => {
        // Filtro de categoría
        const isShared = q.meta && q.meta.zoneType === "dungeon_zone";
        const isOpen = q.meta && q.meta.zoneType === "open_zone";
        const lvl = q.potionLevel || 0;

        if (currentFilter === "shared" && !isShared) return false;
        if (currentFilter === "open" && !isOpen) return false;
        if (currentFilter === "lvl200" && lvl < 180) return false;

        // Búsqueda por texto
        if (!query) return true;
        const inTitle = q.title && q.title.toLowerCase().includes(query);
        const inZone = q.zone && q.zone.toLowerCase().includes(query);
        const inDesc = q.description && q.description.toLowerCase().includes(query);
        const inBoss = q.meta && q.meta.boss && q.meta.boss.toLowerCase().includes(query);
        return inTitle || inZone || inDesc || inBoss;
      });

      indicator.textContent = "Mostrando " + filtered.length + " de " + allQueues.length + " colas disponibles.";

      grid.innerHTML = filtered.map(q => {
        const isShared = q.meta && q.meta.zoneType === "dungeon_zone";
        const lvlClass = getLevelClass(q.potionLevel);
        const lvlText = q.potionLevel ? "Lv. " + q.potionLevel : "Sin Nivel";
        const zoneBadge = q.zone ? '<span class="chip" style="color:#60a5fa;border-color:#1e3a8a;">📍 ' + q.zone + '</span>' : '';

        return \`
          <div class="queue-card" id="card-\${q.id}">
            <div class="queue-avatar">
              \${q.iconUrl ? '<img src="' + q.iconUrl + '" alt="' + q.title + '" loading="lazy" onerror="this.style.display=\\'none\\'">' : '<span class="queue-avatar-placeholder">🛡️</span>'}
            </div>
            <div class="queue-body">
              <div class="queue-title-row">
                <span class="level-badge \${lvlClass}">\${lvlText}</span>
                <span class="queue-title" title="\${q.title}">\${q.title}</span>
              </div>
              <p class="queue-desc">\${q.description || "Sin descripción adicional"}</p>
              <div class="queue-meta-chips">
                \${zoneBadge}
                \${isShared ? '<span class="chip chip-shared">🔗 Mazmorra + Exterior</span>' : '<span class="chip chip-open">🗺️ Zona Abierta</span>'}
                <span class="chip">Cooldown: \${q.advanceCooldown || 60}s</span>
                <span class="chip">ID: \${q.id}</span>
                <button class="delete-btn" onclick="deleteQueue('\${q.id}', '\${q.title.replace(/'/g, \"\\\\'\")}')" title="Eliminar cola si no permite recaudadores">🗑️ Eliminar</button>
              </div>
            </div>
          </div>
        \`;
      }).join("");
    }

    let queueToDelete = null;

    function showToast(msg, isError = false) {
      const toast = document.getElementById("toastNotification");
      toast.textContent = msg;
      toast.style.borderColor = isError ? "#ef4444" : "var(--accent)";
      toast.style.color = isError ? "#fca5a5" : "#fff";
      toast.style.display = "block";
      setTimeout(() => { toast.style.display = "none"; }, 3500);
    }

    function deleteQueue(id, title) {
      queueToDelete = { id, title };
      const promptEl = document.getElementById("modalPromptText");
      promptEl.innerHTML = "Se eliminará permanentemente la cola de <strong>" + title + "</strong> (ID: <code>" + id + "</code>). Esta zona ya no aparecerá en el bot ni en la lista.";
      document.getElementById("confirmModal").classList.add("active");
    }

    document.getElementById("modalCancelBtn").addEventListener("click", () => {
      document.getElementById("confirmModal").classList.remove("active");
      queueToDelete = null;
    });

    document.getElementById("modalConfirmBtn").addEventListener("click", async () => {
      if (!queueToDelete) return;
      const { id, title } = queueToDelete;
      const btn = document.getElementById("modalConfirmBtn");
      btn.disabled = true;
      btn.textContent = "Eliminando...";

      try {
        const res = await fetch("/api/queues/" + encodeURIComponent(id), { method: "DELETE" });
        const json = await res.json();
        if (json.success) {
          const idx = allQueues.findIndex(q => q.id === id);
          if (idx !== -1) allQueues.splice(idx, 1);
          document.getElementById("totalQueuesCount").textContent = allQueues.length;
          renderCards();
          showToast("✅ Cola de \\"" + title + "\\" eliminada con éxito.");
        } else {
          showToast("❌ Error al eliminar: " + (json.error || "Desconocido"), true);
        }
      } catch (err) {
        showToast("❌ Error de red al eliminar la cola", true);
      } finally {
        btn.disabled = false;
        btn.textContent = "Eliminar Definitivamente";
        document.getElementById("confirmModal").classList.remove("active");
        queueToDelete = null;
      }
    });

    // Buscador interactivo
    document.getElementById("searchInput").addEventListener("input", () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(renderCards, 150);
    });

    // Botones de filtro
    document.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        renderCards();
      });
    });

    // Render inicial
    renderCards();
  </script>
</body>
</html>`;

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[BOT] Servicio de health check y estado web escuchando en puerto ${port}`);
  });

  return server;
}

function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

