import React, { useState } from 'react';
import { QueueEvent, QueueMember } from '../types/queue';
import { SIMULATED_PERSONAS } from '../data/queuePresets';
import { soundManager } from '../utils/audio';
import confetti from 'canvas-confetti';
import {
  FastForward,
  UserPlus,
  Trash2,
  Download,
  Shuffle,
  RotateCcw,
  CheckCircle2,
  Users,
  Eye
} from 'lucide-react';

interface HostControlBarProps {
  queue: QueueEvent;
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    role?: string;
  };
  onSwitchUser: (user: { id: string; username: string; displayName: string; avatar: string; role?: string }) => void;
  onAdvanceTurn: () => void;
  onAddDummyMember: (name?: string, note?: string) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
  onExportCsv: () => void;
}

export const HostControlBar: React.FC<HostControlBarProps> = ({
  queue,
  currentUser,
  onSwitchUser,
  onAdvanceTurn,
  onAddDummyMember,
  onClearQueue,
  onShuffleQueue,
  onExportCsv,
}) => {
  const [customName, setCustomName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    onAddDummyMember(customName.trim(), 'Agregado manualmente');
    setCustomName('');
    setShowAddForm(false);
  };

  const handleAdvance = () => {
    soundManager.playYourTurn();
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 }
    });
    onAdvanceTurn();
  };

  return (
    <div className="bg-[#2b2d31] border border-gray-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-amber-400">⚡</span>
            <span>Panel de Control del Anfitrión / Host</span>
          </h4>
          <p className="text-xs text-gray-400">
            Prueba cómo interactúan los usuarios, pasa turnos y gestiona la cola en directo.
          </p>
        </div>

        {/* User Persona Switcher */}
        <div className="flex items-center space-x-2 bg-[#1e1f22] p-1.5 rounded-lg border border-gray-700">
          <Eye className="w-4 h-4 text-indigo-400 ml-1" />
          <span className="text-xs text-gray-400">Ver como:</span>
          <select
            value={currentUser.id}
            onChange={(e) => {
              const selected = SIMULATED_PERSONAS.find((p) => p.id === e.target.value);
              if (selected) onSwitchUser(selected);
            }}
            className="bg-[#2b2d31] text-xs text-white px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-[#5865F2] cursor-pointer"
          >
            {SIMULATED_PERSONAS.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.displayName} ({persona.role || 'Usuario'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Host Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={handleAdvance}
          disabled={queue.waitingList.length === 0 && queue.currentTurn.length === 0}
          className="p-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow"
        >
          <FastForward className="w-4 h-4" />
          <span>Llamar al Siguiente</span>
        </button>

        <button
          onClick={() => onAddDummyMember()}
          className="p-2.5 rounded-lg bg-[#313338] hover:bg-[#3d3f45] border border-gray-700 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          title="Añade un participante virtual a la cola"
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>+1 Usuario Aleatorio</span>
        </button>

        <button
          onClick={onShuffleQueue}
          disabled={queue.waitingList.length < 2}
          className="p-2.5 rounded-lg bg-[#313338] hover:bg-[#3d3f45] border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          title="Aleatorizar orden de espera"
        >
          <Shuffle className="w-4 h-4 text-amber-400" />
          <span>Mezclar Orden</span>
        </button>

        <button
          onClick={onExportCsv}
          className="p-2.5 rounded-lg bg-[#313338] hover:bg-[#3d3f45] border border-gray-700 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          title="Descargar lista de asistentes en archivo"
        >
          <Download className="w-4 h-4 text-sky-400" />
          <span>Exportar Lista</span>
        </button>
      </div>

      {/* Secondary Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-800 text-xs">
        <div className="flex items-center space-x-2">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 underline cursor-pointer"
            >
              <span>+ Añadir persona con nombre personalizado</span>
            </button>
          ) : (
            <form onSubmit={handleQuickAdd} className="flex items-center space-x-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nombre de usuario..."
                autoFocus
                className="bg-[#1e1f22] border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#5865F2]"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded font-semibold cursor-pointer"
              >
                Añadir
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-white px-1.5 py-1"
              >
                ✕
              </button>
            </form>
          )}
        </div>

        <button
          onClick={() => {
            if (window.confirm('¿Seguro que deseas vaciar todos los miembros de la lista de espera?')) {
              onClearQueue();
            }
          }}
          disabled={queue.waitingList.length === 0 && queue.currentTurn.length === 0}
          className="text-red-400 hover:text-red-300 disabled:opacity-30 disabled:hover:text-red-400 flex items-center space-x-1 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Vaciar Cola</span>
        </button>
      </div>
    </div>
  );
};
