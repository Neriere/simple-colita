import React, { useState } from 'react';
import { getBotPackageFiles } from '../utils/botFiles';
import JSZip from 'jszip';
import {
  Copy,
  Check,
  Download,
  Terminal,
  FileCode,
  Key,
  Package,
  Settings,
  ExternalLink,
  Bot,
  Zap,
  HelpCircle,
  FolderArchive,
  Code2,
  CheckCircle2,
  Sparkles,
  Play
} from 'lucide-react';

export const BotCodeExporter: React.FC = () => {
  const [slashCommandName, setSlashCommandName] = useState('cola');
  const [embedColor, setEmbedColor] = useState('#5865F2');
  const [enableNotes, setEnableNotes] = useState(true);
  const [enableDm, setEnableDm] = useState(true);
  const [hostOnlyAdvance, setHostOnlyAdvance] = useState(true);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const files = getBotPackageFiles({
    slashCommandName,
    embedColor,
    enableNotes,
    enableDm,
    hostOnlyAdvance,
  });

  const currentFile = files[activeFileIndex] || files[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([currentFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();
      files.forEach((f) => {
        zip.file(f.name, f.content);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'discord-queue-bot-project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-[#5865F2]/20 via-[#5865F2]/10 to-transparent border border-[#5865F2]/30 rounded-2xl p-5 sm:p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#5865F2] flex items-center justify-center text-white text-2xl shadow-lg shrink-0">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Bot Listo para tu Servidor de Discord</h2>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                  Discord.js v14
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-2xl">
                Este es el código completo del <strong>bot real para Discord</strong> con botones interactivos.
                Descárgalo como un archivo <strong>.ZIP listo para ejecutar</strong> o copia los archivos individualmente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="px-4 py-2.5 bg-[#248046] hover:bg-[#1a6334] text-white text-xs sm:text-sm font-bold rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-lg shadow-emerald-900/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <FolderArchive className="w-4 h-4" />
              <span>{isZipping ? 'Comprimiendo...' : 'Descargar Proyecto Completo (.ZIP)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Settings & Code View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Settings & Live Customizer (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#2b2d31] rounded-xl border border-gray-800 p-5 space-y-4 shadow-md">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
              <Settings className="w-4 h-4 text-indigo-400" />
              <span>Ajustes del Bot</span>
            </h3>

            {/* Slash command name */}
            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1.5">
                Nombre del Comando Slash
              </label>
              <div className="flex items-center">
                <span className="bg-[#1e1f22] text-gray-400 text-sm px-3 py-2 rounded-l-lg border border-r-0 border-gray-700 font-mono">
                  /
                </span>
                <input
                  type="text"
                  value={slashCommandName}
                  onChange={(e) => setSlashCommandName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="cola"
                  className="w-full bg-[#1e1f22] border border-gray-700 rounded-r-lg p-2 text-sm text-white font-mono focus:outline-none focus:border-[#5865F2]"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Escribirás <code className="text-indigo-300">/{slashCommandName} crear</code> en Discord para iniciar una cola.
              </p>
            </div>

            {/* Embed Color */}
            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1.5">
                Color del Mensaje (Embed)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={embedColor}
                  onChange={(e) => setEmbedColor(e.target.value)}
                  className="w-9 h-9 rounded border border-gray-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={embedColor}
                  onChange={(e) => setEmbedColor(e.target.value)}
                  className="w-28 bg-[#1e1f22] border border-gray-700 rounded p-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Toggle Features */}
            <div className="space-y-3 pt-3 border-t border-gray-800">
              <span className="text-[11px] uppercase font-bold text-gray-400 tracking-wider block">
                Comportamiento de Botones
              </span>

              <label className="flex items-start space-x-2 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableNotes}
                  onChange={(e) => setEnableNotes(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#5865F2] rounded"
                />
                <div>
                  <span className="font-semibold text-white">Pedir nota / Tag al unirse</span>
                  <p className="text-[11px] text-gray-400">Abre una ventana emergente (Modal) para escribir Gamertag o motivo.</p>
                </div>
              </label>

              <label className="flex items-start space-x-2 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableDm}
                  onChange={(e) => setEnableDm(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#5865F2] rounded"
                />
                <div>
                  <span className="font-semibold text-white">Aviso por Mensaje Directo (DM)</span>
                  <p className="text-[11px] text-gray-400">El bot le envía un mensaje privado a la persona cuando es su turno.</p>
                </div>
              </label>

              <label className="flex items-start space-x-2 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hostOnlyAdvance}
                  onChange={(e) => setHostOnlyAdvance(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#5865F2] rounded"
                />
                <div>
                  <span className="font-semibold text-white">Protección de botones de Anfitrión</span>
                  <p className="text-[11px] text-gray-400">Solo el creador del evento o moderadores pueden pasar de turno o cerrar.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Quick Setup Checklist */}
          <div className="bg-[#2b2d31] rounded-xl border border-gray-800 p-5 space-y-3 shadow-md">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>¿Qué hace este bot en Discord?</span>
            </h4>
            <ul className="text-xs text-gray-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>/{slashCommandName} crear:</strong> Publica el panel con botones interactivos.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Botón 🟢 Unirse:</strong> Agrega al usuario a la lista en orden de llegada sin duplicados.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Botón ⏭️ Siguiente:</strong> Llama al siguiente participante y lo etiqueta (<code className="text-indigo-300">@usuario</code>).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Botón 🔍 Mi Posición:</strong> Respuesta privada (efímera) indicando su puesto exacto.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Code Viewer (8 cols) */}
        <div className="lg:col-span-8 bg-[#1e1f22] rounded-xl border border-gray-800 overflow-hidden shadow-xl flex flex-col">
          {/* File Tabs */}
          <div className="bg-[#2b2d31] px-4 py-2 border-b border-gray-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              {files.map((file, idx) => (
                <button
                  key={file.name}
                  onClick={() => setActiveFileIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                    activeFileIndex === idx
                      ? 'bg-[#5865F2] text-white shadow'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{file.name}</span>
                  {file.badge && (
                    <span className="bg-emerald-500 text-black text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ml-1">
                      {file.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-[#313338] hover:bg-[#3d3f45] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 border border-gray-700 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>

              <button
                onClick={handleDownloadSingle}
                className="px-3 py-1.5 bg-[#313338] hover:bg-[#3d3f45] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 border border-gray-700 transition-colors cursor-pointer"
                title={`Descargar ${currentFile.name}`}
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Descargar</span>
              </button>
            </div>
          </div>

          {/* Description bar */}
          <div className="bg-[#24262b] px-4 py-2 text-xs text-gray-400 border-b border-gray-800/80 flex items-center justify-between">
            <span>{currentFile.description}</span>
            <span className="text-[11px] font-mono text-gray-500 uppercase">{currentFile.language}</span>
          </div>

          {/* Code Viewer pre */}
          <div className="p-4 overflow-x-auto max-h-[580px] font-mono text-xs text-gray-200 leading-relaxed bg-[#1e1f22] custom-scrollbar">
            <pre className="whitespace-pre">{currentFile.content}</pre>
          </div>
        </div>
      </div>

      {/* 3-Step Setup Guide */}
      <div className="bg-[#2b2d31] rounded-2xl border border-gray-800 p-6 space-y-4 shadow-md">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <span>Cómo Instalar y Encender Tu Bot en Discord (Paso a Paso)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#1e1f22] p-4 rounded-xl border border-gray-800 space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#5865F2] text-white text-xs font-bold flex items-center justify-center">
              1
            </div>
            <h4 className="text-sm font-bold text-white">Obtener el Token en Discord</h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              1. Entra a{' '}
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noreferrer"
                className="text-[#5865F2] hover:underline inline-flex items-center gap-1 font-semibold"
              >
                Discord Developer Portal <ExternalLink className="w-3 h-3" />
              </a>
              .<br />
              2. Crea una <strong>"New Application"</strong>.<br />
              3. Ve a la pestaña <strong>"Bot"</strong> &gt; pulsa <strong>"Reset Token"</strong> y copia el Token.
            </p>
          </div>

          <div className="bg-[#1e1f22] p-4 rounded-xl border border-gray-800 space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#5865F2] text-white text-xs font-bold flex items-center justify-center">
              2
            </div>
            <h4 className="text-sm font-bold text-white">Invitar al Bot a tu Servidor</h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              En <strong>OAuth2 &gt; URL Generator</strong> selecciona:
              <br />• Scopes: <code className="bg-gray-800 px-1 py-0.5 rounded text-[11px] text-amber-300">bot</code> y <code className="bg-gray-800 px-1 py-0.5 rounded text-[11px] text-amber-300">applications.commands</code>.
              <br />• Permisos: <code className="bg-gray-800 px-1 py-0.5 rounded text-[11px] text-emerald-300">Send Messages</code>, <code className="bg-gray-800 px-1 py-0.5 rounded text-[11px] text-emerald-300">Embed Links</code>.
              <br />Abre el link generado para unirlo a tu servidor.
            </p>
          </div>

          <div className="bg-[#1e1f22] p-4 rounded-xl border border-gray-800 space-y-2">
            <div className="w-7 h-7 rounded-full bg-[#5865F2] text-white text-xs font-bold flex items-center justify-center">
              3
            </div>
            <h4 className="text-sm font-bold text-white">Descargar y Encender</h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              Descarga el <strong>.ZIP</strong>, abre el archivo <code className="text-indigo-300">.env</code> y pega tu Token. Luego en tu terminal corre:
            </p>
            <div className="bg-black/60 p-2.5 rounded font-mono text-[11px] text-emerald-400 space-y-1">
              <div>npm install</div>
              <div>node bot.js</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
