import React, { useState } from 'react';
import { PRESET_TEMPLATES } from '../data/queuePresets';
import { PresetTemplate, QueueEvent } from '../types/queue';
import { Sparkles, X, Plus, Clock, Users, Hash, Shield } from 'lucide-react';

interface CreateQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (newEvent: Partial<QueueEvent>) => void;
}

export const CreateQueueModal: React.FC<CreateQueueModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [potionLevel, setPotionLevel] = useState<number | undefined>(undefined);
  const [zoneCategory, setZoneCategory] = useState<string>('all');
  const [description, setDescription] = useState('');
  const [channelName, setChannelName] = useState('🎮・recaudadores-20-100');
  const [slotsPerTurn, setSlotsPerTurn] = useState(1);
  const [maxCapacity, setMaxCapacity] = useState(15);
  const [turnTimeLimitMinutes, setTurnTimeLimitMinutes] = useState(5);
  const [allowNotes, setAllowNotes] = useState(true);
  const [notesPrompt, setNotesPrompt] = useState('Tu GamerTag o Razón de consulta');
  const [colorHex, setColorHex] = useState('#5865F2');

  if (!isOpen) return null;

  const applyPreset = (preset: PresetTemplate) => {
    setTitle(preset.title);
    setDescription(preset.description);
    setSlotsPerTurn(preset.slotsPerTurn);
    setMaxCapacity(preset.maxCapacity);
    setTurnTimeLimitMinutes(preset.turnTimeLimitMinutes);
    setAllowNotes(preset.allowNotes);
    setNotesPrompt(preset.notesPrompt);
    setColorHex(preset.colorHex);
    if (preset.potionLevel) {
      setPotionLevel(preset.potionLevel);
      setChannelName(preset.potionLevel <= 100 ? '🎮・recaudadores-20-100' : '🔥・recaudadores-110-200');
    }
  };

  const handleLevelChange = (lvl: number | undefined) => {
    setPotionLevel(lvl);
    if (!lvl) return;
    if (lvl <= 60) setColorHex('#57F287');
    else if (lvl <= 100) setColorHex('#5865F2');
    else if (lvl <= 160) setColorHex('#FEE75C');
    else setColorHex('#EB459E');

    // Autoseleccionar canal sugerido si es por rangos
    if (lvl <= 100 && channelName.includes('110-200')) {
      setChannelName('🎮・recaudadores-20-100');
    } else if (lvl > 100 && channelName.includes('20-100')) {
      setChannelName('🔥・recaudadores-110-200');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreate({
      title: title.trim(),
      potionLevel,
      zoneCategory,
      description: description.trim(),
      channelName: channelName.startsWith('#') ? channelName : `#${channelName}`,
      slotsPerTurn: Number(slotsPerTurn) || 1,
      maxCapacity: Number(maxCapacity) || 0,
      turnTimeLimitMinutes: Number(turnTimeLimitMinutes) || 0,
      allowNotes,
      notesPrompt: notesPrompt.trim(),
      colorHex,
      status: 'active',
      currentTurn: [],
      waitingList: [],
      history: [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#2b2d31] text-gray-100 rounded-2xl border border-[#3f4147] max-w-2xl w-full p-6 shadow-2xl animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#3f4147] pb-4 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Crear Nuevo Evento / Lista de Espera</h3>
              <p className="text-xs text-gray-400">Configura la cola interactiva para tu servidor de Discord</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#35373c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="mb-5">
          <label className="block text-xs uppercase font-bold text-gray-400 mb-2">
            Plantillas Rápidas (1 Clic)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESET_TEMPLATES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-left p-2.5 rounded-lg bg-[#1e1f22] hover:bg-[#35373c] border border-gray-700/60 hover:border-[#5865F2] transition-all group cursor-pointer"
              >
                <div className="font-semibold text-xs text-white group-hover:text-[#5865F2] truncate">
                  {preset.title}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {preset.slotsPerTurn} por turno • {preset.maxCapacity || '∞'} max
                </div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase font-bold text-gray-300 mb-1">
                Título del Evento / Cola *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Torneo 1v1 Nocturno, Consultas Staff, Pruebas de Equipo..."
                className="w-full bg-[#1e1f22] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
              />
            </div>

            {/* Potion Level / Dungeon Selector */}
            <div className="sm:col-span-2 bg-[#1e1f22] p-3 rounded-lg border border-gray-700/80">
              <label className="block text-xs uppercase font-bold text-gray-200 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  🧪 Nivel de Poción / Mazmorra (Dofus)
                </span>
                <span className="text-[11px] text-gray-400 normal-case">
                  {potionLevel ? `Seleccionado: Lv. ${potionLevel}` : 'Sin nivel especificado'}
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => handleLevelChange(undefined)}
                  className={`px-2 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                    potionLevel === undefined
                      ? 'bg-gray-700 text-white border border-gray-500'
                      : 'bg-[#2b2d31] text-gray-400 hover:text-white'
                  }`}
                >
                  General
                </button>
                {[20, 40, 60, 80, 100, 120, 140, 160, 180, 200].map((lvl) => {
                  const isSelected = potionLevel === lvl;
                  let colorClass = 'border-emerald-500 text-emerald-400';
                  if (lvl > 60 && lvl <= 100) colorClass = 'border-indigo-500 text-indigo-400';
                  if (lvl > 100 && lvl <= 160) colorClass = 'border-amber-500 text-amber-300';
                  if (lvl > 160) colorClass = 'border-pink-500 text-pink-400';

                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleLevelChange(lvl)}
                      className={`px-2 py-1.5 rounded text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? `bg-[#5865F2] text-white border-white shadow-sm`
                          : `bg-[#2b2d31] hover:bg-[#35373c] ${colorClass}`
                      }`}
                    >
                      Lv. {lvl}
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] text-gray-400 mt-2 flex items-center justify-between">
                <span>🟢 20-100: Canal de Recaudadores Básico</span>
                <span>🔥 110-200: Canal de Mazmorras &amp; Endgame</span>
              </div>
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase font-bold text-gray-300 mb-1">
                Descripción / Instrucciones (Opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Instrucciones para los participantes, reglas o requisitos..."
                className="w-full bg-[#1e1f22] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2] resize-none"
              />
            </div>

            {/* Channel Name */}
            <div>
              <label className="block text-xs uppercase font-bold text-gray-300 mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-gray-400" /> Canal de Discord
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="#sala-de-espera"
                className="w-full bg-[#1e1f22] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
              />
            </div>

            {/* Slots per turn */}
            <div>
              <label className="block text-xs uppercase font-bold text-gray-300 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-gray-400" /> Personas por Turno
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={slotsPerTurn}
                onChange={(e) => setSlotsPerTurn(Number(e.target.value))}
                className="w-full bg-[#1e1f22] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                1 para 1v1/soporte, 2 para parejas, 4 para squads
              </span>
            </div>

            {/* Max Capacity */}
            <div>
              <label className="block text-xs uppercase font-bold text-gray-300 mb-1 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-gray-400" /> Límite Máximo en Cola
              </label>
              <input
                type="number"
                min={0}
                max={200}
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(Number(e.target.value))}
                className="w-full bg-[#1e1f22] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">0 = sin límite de participantes</span>
            </div>

            {/* Turn time limit */}
            <div>
              <label className="block text-xs uppercase font-bold text-gray-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" /> Tiempo estimado por turno (min)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={turnTimeLimitMinutes}
                onChange={(e) => setTurnTimeLimitMinutes(Number(e.target.value))}
                className="w-full bg-[#1e1f22] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">Muestra cronómetro de referencia</span>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="pt-3 border-t border-gray-700/60 space-y-3">
            <div className="flex items-center justify-between bg-[#1e1f22] p-3 rounded-lg border border-gray-700">
              <div>
                <span className="text-xs font-semibold text-white block">
                  Solicitar Nota / Identificador al Unirse
                </span>
                <span className="text-[11px] text-gray-400">
                  Abre una ventana emergente en Discord para que el usuario escriba su RiotID, SteamID o motivo.
                </span>
              </div>
              <input
                type="checkbox"
                checked={allowNotes}
                onChange={(e) => setAllowNotes(e.target.checked)}
                className="w-4 h-4 accent-[#5865F2] cursor-pointer"
              />
            </div>

            {allowNotes && (
              <div>
                <label className="block text-xs uppercase font-bold text-gray-400 mb-1">
                  Texto de ayuda del campo
                </label>
                <input
                  type="text"
                  value={notesPrompt}
                  onChange={(e) => setNotesPrompt(e.target.value)}
                  placeholder="Ej: Ingresa tu Tag de juego o consulta..."
                  className="w-full bg-[#1e1f22] border border-gray-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                />
              </div>
            )}

            {/* Embed Color picker */}
            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1">
                Color del Embed de Discord
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-600 cursor-pointer bg-transparent"
                />
                <span className="text-xs text-gray-300 font-mono">{colorHex}</span>
                <div className="flex space-x-1.5">
                  {['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#9B59B6'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setColorHex(col)}
                      className="w-5 h-5 rounded-full border border-gray-600 hover:scale-110 transition-transform"
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#3f4147]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-[#35373c] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-2.5 text-sm font-semibold bg-[#5865F2] hover:bg-[#4752c4] text-white rounded-lg transition-colors flex items-center space-x-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Evento y Abrir Cola</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
