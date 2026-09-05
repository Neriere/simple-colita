import http from "http";

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

    // Respuesta HTML para el navegador / preview de AI Studio
    const isOnline = Boolean(client.user && botState.isOnline);
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discord Queue Bot - Estado</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --border: #334155;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --accent: #5865f2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      max-width: 620px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo {
      width: 42px;
      height: 42px;
      background: var(--accent);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 20px;
    }
    h1 { font-size: 20px; font-weight: 700; color: #fff; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      background: ${isOnline ? "rgba(34, 197, 94, 0.15)" : "rgba(245, 158, 11, 0.15)"};
      color: ${isOnline ? "var(--success)" : "var(--warning)"};
      border: 1px solid ${isOnline ? "rgba(34, 197, 94, 0.3)" : "rgba(245, 158, 11, 0.3)"};
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${isOnline ? "var(--success)" : "var(--warning)"};
      ${isOnline ? "box-shadow: 0 0 8px var(--success);" : ""}
    }
    .alert {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 16px;
      border-radius: 12px;
      margin-bottom: 24px;
      font-size: 14px;
      line-height: 1.5;
    }
    .alert strong { color: #fff; display: block; margin-bottom: 6px; }
    .alert ol { margin-left: 20px; margin-top: 8px; }
    .alert li { margin-bottom: 4px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-box {
      background: rgba(15, 23, 42, 0.6);
      padding: 14px;
      border-radius: 10px;
      border: 1px solid var(--border);
      text-align: center;
    }
    .stat-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 18px; font-weight: 700; margin-top: 4px; color: #fff; }
    .info-section {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.6;
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }
    .code-badge {
      background: rgba(0,0,0,0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      color: #38bdf8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title-group">
        <div class="logo">⚡</div>
        <div>
          <h1>Discord Queue Bot</h1>
          <p style="font-size: 13px; color: var(--muted);">Servicio de Colas y Turnos</p>
        </div>
      </div>
      <div class="status-badge">
        <div class="status-dot"></div>
        ${isOnline ? `Online (${client.user ? client.user.username : "Conectado"})` : "Esperando Token Válido"}
      </div>
    </div>

    ${
      !isOnline && botState.loginError
        ? `
    <div class="alert">
      <strong>⚠️ Estado de Autenticación con Discord</strong>
      <p>${botState.loginError.includes("invalid token") ? "El token de Discord configurado en <code>DISCORD_TOKEN</code> no es válido o fue revocado por Discord." : botState.loginError}</p>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(239, 68, 68, 0.2);">
        <strong>¿Cómo solucionarlo?</strong>
        <ol>
          <li>Entra en <a href="https://discord.com/developers/applications" target="_blank" style="color: #60a5fa; text-decoration: underline;">Discord Developer Portal</a>.</li>
          <li>Selecciona tu aplicación y ve a la pestaña <strong>Bot</strong>.</li>
          <li>Haz clic en <strong>Reset Token</strong> para generar un nuevo token.</li>
          <li>Copia el nuevo token y actualízalo en las variables de entorno de tu hosting / panel.</li>
        </ol>
      </div>
    </div>
    `
        : ""
    }

    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-label">Estado</div>
        <div class="stat-value" style="color: ${isOnline ? "var(--success)" : "var(--warning)"};">
          ${isOnline ? "ACTIVO" : "PENDIENTE"}
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Colas Activas</div>
        <div class="stat-value">${queues.size}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Uptime</div>
        <div class="stat-value">${uptimeFormatted}</div>
      </div>
    </div>

    <div class="info-section">
      <p>Este servicio mantiene activo el bot de Discord y responde al health check en el puerto <code>3000</code>. Admite comandos Slash como <span class="code-badge">/cola crear</span>, <span class="code-badge">/cola tarjeta</span>, <span class="code-badge">/cola reset</span> y controles interactivos de turnos.</p>
    </div>
  </div>
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

