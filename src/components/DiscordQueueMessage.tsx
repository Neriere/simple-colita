import React, { useState, useEffect } from 'react';
import { QueueEvent, QueueMember } from '../types/queue';
import { soundManager } from '../utils/audio';
import confetti from 'canvas-confetti';
import {
  Clock,
  UserCheck,
  Users,
  AlertCircle,
  Hash,
  Crown,
  ChevronRight,
  UserX,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  StickyNote
} from 'lucide-react';

interface DiscordQueueMessageProps {
  queue: QueueEvent;
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
  isHost: boolean;
  onJoin: (note?: string) => void;
  onLeave: () => void;
  onAdvanceNext: () => void;
  onUndoTurn?: () => void;
  onRemoveMember: (memberId: string) => void;
  onCloseQueue: () => void;
  onTogglePause: () => void;
}

export const DiscordQueueMessage: React.FC<DiscordQueueMessageProps> = ({
  queue,
  currentUser,
  isHost,
  onJoin,
  onLeave,
  onAdvanceNext,
  onUndoTurn,
  onRemoveMember,
  onCloseQueue,
  onTogglePause,
}) => {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [positionAlert, setPositionAlert] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(!soundManager.isMuted());
  const [elapsedTime, setElapsedTime] = useState(0);

  const isInTurn = queue.currentTurn.some((u) => u.id === currentUser.id);
  const isInWaiting = queue.waitingList.some((u) => u.id === currentUser.id);
  const userPosition = queue.waitingList.findIndex((u) => u.id === currentUser.id) + 1;
  const isFull = queue.maxCapacity > 0 && (queue.currentTurn.length + queue.waitingList.length) >= queue.maxCapacity;
  const isClosed = queue.status === 'closed';
  const isPaused = queue.status === 'paused';

  // Timer for current turn
  useEffect(() => {
    const interval = setInterval(() => {
      if (queue.currentTurn.length > 0 && queue.currentTurn[0]?.turnStartTime) {
        const diff = Math.floor((Date.now() - queue.currentTurn[0].turnStartTime) / 1000);
        setElapsedTime(diff);
      } else {
        setElapsedTime(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [queue.currentTurn]);

  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    soundManager.setMuted(!nextState);
    if (nextState) soundManager.playClick();
  };

  const handleJoinClick = () => {
    soundManager.playClick();
    if (queue.allowNotes) {
      setShowNoteModal(true);
    } else {
      onJoin();
      soundManager.playJoin();
    }
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowNoteModal(false);
    onJoin(userNote.trim() || undefined);
    setUserNote('');
    soundManager.playJoin();
  };

  const handleLeaveClick = () => {
    soundManager.playLeave();
    onLeave();
  };

  const handleCheckPosition = () => {
    soundManager.playClick();
    if (isInTurn) {
      setPositionAlert('🌟 ¡Es tu turno ahora mismo! Contacta con el anfitrión.');
    } else if (isInWaiting) {
      setPositionAlert(`📍 Tu posición actual es la #${userPosition} (hay ${userPosition - 1} persona(s) delante de ti).`);
    } else {
      setPositionAlert('❌ No estás en la cola actualmente. Pulsa "🟢 Unirse a la Cola" para registrarte.');
    }
  };

  const handleNextClick = () => {
    soundManager.playYourTurn();
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.6 }
    });
    onAdvanceNext();
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#313338] text-gray-100 rounded-xl border border-[#202225] shadow-2xl overflow-hidden font-sans">
      {/* Discord Channel Bar Simulator */}
      <div className="bg-[#2b2d31] px-4 py-3 border-b border-[#202225] flex items-center justify-between">
        <div className="flex items-center space-x-2 text-gray-300">
          <Hash className="w-5 h-5 text-gray-400" />
          <span className="font-semibold text-white tracking-wide">{queue.channelName}</span>
          <span className="text-xs bg-[#1e1f22] text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">
            Vista del Servidor
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <button
            onClick={toggleSound}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition-colors ${
              soundEnabled
                ? 'bg-[#5865F2]/20 text-[#5865F2] hover:bg-[#5865F2]/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            title="Efectos de sonido de Discord"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Sonidos ON' : 'Sonidos OFF'}</span>
          </button>
          <span className="flex items-center space-x-1.5 text-gray-400 bg-[#1e1f22] px-2.5 py-1 rounded">
            <span className={`w-2 h-2 rounded-full ${isClosed ? 'bg-red-500' : isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="capitalize">{queue.status === 'active' ? 'Cola En Vivo' : queue.status === 'paused' ? 'Pausada' : 'Cerrada'}</span>
          </span>
        </div>
      </div>

      {/* Message Content */}
      <div className="p-4 sm:p-6 space-y-4">
        {/* Discord Bot Header in Chat */}
        <div className="flex items-start space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-bold text-lg shadow">
              🤖
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#23a55a] w-3.5 h-3.5 rounded-full border-2 border-[#313338]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-white hover:underline cursor-pointer">QueueBot</span>
              <span className="bg-[#5865F2] text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">
                BOT
              </span>
              <span className="text-xs text-gray-400">
                Hoy a las {new Date(queue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Discord Embed Container */}
            <div
              className="mt-3 bg-[#2b2d31] rounded-md border-l-4 p-4 shadow-md transition-all space-y-4"
              style={{
                borderLeftColor: isClosed
                  ? '#ED4245'
                  : queue.potionLevel
                  ? queue.potionLevel <= 60
                    ? '#57F287'
                    : queue.potionLevel <= 100
                    ? '#5865F2'
                    : queue.potionLevel <= 160
                    ? '#FEE75C'
                    : '#EB459E'
                  : queue.colorHex || '#5865F2',
              }}
            >
              {/* Embed Title & Description */}
              <div>
                <h3 className="text-base font-bold text-white leading-tight flex items-center gap-2 flex-wrap">
                  {queue.potionLevel && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        queue.potionLevel <= 60
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : queue.potionLevel <= 100
                          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                          : queue.potionLevel <= 160
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
                      }`}
                    >
                      {queue.potionLevel >= 180 ? '🔥' : '🧪'} [Lv. {queue.potionLevel}]
                    </span>
                  )}
                  <span>{queue.title}</span>
                  {isClosed && <span>🔒</span>}
                </h3>
                {queue.description && (
                  <p className="text-xs text-gray-300 italic mt-0.5 whitespace-pre-line leading-normal">
                    {queue.description}
                  </p>
                )}
                {isClosed && (
                  <p className="text-xs text-red-400 italic mt-1">
                    *🔒 Cola cerrada temporalmente (Abre a las 18:00 hrs Chile o con /cola abrir).*
                  </p>
                )}
              </div>

              {/* FIELD 1: EN TURNO (Exact Embed Field) */}
              <div>
                <div className="text-xs font-bold text-gray-300 uppercase tracking-wide mb-1">
                  EN TURNO
                </div>
                <div className="text-xs text-gray-200 leading-relaxed">
                  {queue.currentTurn.length === 0 ? (
                    <span className="text-gray-400 italic">*(Nadie en turno)*</span>
                  ) : (
                    queue.currentTurn.map((m) => {
                      const notePart = m.note ? ` [${m.note}]` : '';
                      const dateObj = m.turnStartTime ? new Date(m.turnStartTime) : null;
                      const timeStr = dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      const fullTooltip = dateObj ? dateObj.toLocaleString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
                      return (
                        <div key={m.id} className="pl-2 border-l-2 border-emerald-500 py-0.5 my-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-emerald-400 font-bold">🟢 @{m.displayName || m.username}</span>
                          {notePart && <span className="text-gray-300">{notePart}</span>}
                          {timeStr && (
                            <span
                              className="bg-[#1e1f22] text-gray-300 px-1.5 py-0.5 rounded text-[11px] font-mono cursor-help hover:text-white hover:bg-[#232428] transition-colors"
                              title={fullTooltip}
                            >
                              ({timeStr})
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* FIELDS 2 & 3: Inline Embed Fields Grid (50% each) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* EN COLA */}
                <div>
                  <div className="text-xs font-bold text-gray-300 uppercase tracking-wide mb-1">
                    EN COLA ({queue.waitingList.length})
                  </div>
                  <div className="text-xs text-gray-200 leading-relaxed min-h-[48px] space-y-1">
                    {queue.waitingList.length === 0 ? (
                      <span className="text-gray-400 italic">*(Vacía)*</span>
                    ) : (
                      queue.waitingList.map((m, idx) => {
                        const notePart = m.note ? ` [${m.note}]` : '';
                        const dateObj = m.joinedAt ? new Date(m.joinedAt) : null;
                        const timeStr = dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        const fullTooltip = dateObj ? dateObj.toLocaleString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
                        return (
                          <div key={m.id} className="flex items-center gap-1 flex-wrap">
                            <span className="text-gray-400 font-bold">{String(idx + 1).padStart(2, '0')}.</span>
                            <span className="text-white font-medium">@{m.displayName || m.username}</span>
                            {notePart && <span className="text-gray-400">{notePart}</span>}
                            {timeStr && (
                              <span
                                className="bg-[#1e1f22] text-gray-300 px-1 py-0.2 rounded text-[11px] font-mono cursor-help hover:text-white hover:bg-[#232428] transition-colors"
                                title={fullTooltip}
                              >
                                ({timeStr})
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* TURNOS PASADOS */}
                <div>
                  <div className="text-xs font-bold text-gray-300 uppercase tracking-wide mb-1">
                    TURNOS PASADOS ({queue.pastTurns ? Math.min(queue.pastTurns.length, 8) : 0})
                  </div>
                  <div className="text-xs text-gray-200 leading-relaxed min-h-[48px] space-y-1">
                    {(!queue.pastTurns || queue.pastTurns.length === 0) ? (
                      <span className="text-gray-400 italic">*(Sin turnos previos)*</span>
                    ) : (
                      queue.pastTurns.slice(-8).reverse().map((m) => {
                        const notePart = m.note ? ` [${m.note}]` : '';
                        const dateObj = (m.completedAt || m.joinedAt) ? new Date(m.completedAt || m.joinedAt) : null;
                        const timeStr = dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        const fullTooltip = dateObj ? dateObj.toLocaleString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
                        return (
                          <div key={m.id} className="flex items-center gap-1 flex-wrap text-gray-300">
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-200">@{m.displayName || m.username}</span>
                            {notePart && <span className="text-gray-400">{notePart}</span>}
                            {timeStr && (
                              <span
                                className="bg-[#1e1f22] text-gray-300 px-1 py-0.2 rounded text-[11px] font-mono cursor-help hover:text-white hover:bg-[#232428] transition-colors"
                                title={fullTooltip}
                              >
                                ({timeStr})
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Banner if present */}
              {queue.bannerUrl && (
                <div className="pt-1">
                  <img
                    src={queue.bannerUrl}
                    alt="Embed Banner"
                    className="w-full max-h-48 object-cover rounded"
                  />
                </div>
              )}

              {/* Embed Footer (Exact footer text generated by buildQueueEmbed) */}
              <div className="pt-2 border-t border-gray-700/40 text-[11px] text-gray-400 flex flex-wrap items-center gap-1 font-sans">
                <span>{queue.lastAdvancedBy ? `Último avance por: @${queue.lastAdvancedBy.username}` : `Estado: ${isClosed ? '🔒 CERRADA' : '🟢 ABIERTA'}`}</span>
                <span>•</span>
                <span>Total anotados: {queue.currentTurn.length + queue.waitingList.length}{queue.maxCapacity > 0 ? `/${queue.maxCapacity}` : ''}</span>
                {queue.hostName && (
                  <>
                    <span>•</span>
                    <span>Organizador: @{queue.hostName}</span>
                  </>
                )}
              </div>
            </div>

            {/* Discord Interactive Action Buttons (4 botones exactos: Unirse, Salir, Siguiente, Atrás - sin botón cerrar) */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={handleJoinClick}
                disabled={isClosed || isPaused || isFull || isInWaiting || isInTurn}
                className={`px-4 py-2 rounded font-semibold text-sm text-white flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 ${
                  isClosed || isPaused || isFull || isInWaiting || isInTurn
                    ? 'bg-[#23a55a]/50 text-gray-300 cursor-not-allowed'
                    : 'bg-[#23a55a] hover:bg-[#1f9350] text-white cursor-pointer'
                }`}
              >
                <span>Unirse</span>
              </button>

              <button
                onClick={handleLeaveClick}
                disabled={isClosed || (!isInWaiting && !isInTurn)}
                className={`px-4 py-2 rounded font-semibold text-sm text-white flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 ${
                  isClosed || (!isInWaiting && !isInTurn)
                    ? 'bg-[#4e5058]/50 text-gray-400 cursor-not-allowed'
                    : 'bg-[#4e5058] hover:bg-[#6d6f78] cursor-pointer'
                }`}
              >
                <span>Salir</span>
              </button>

              <button
                onClick={handleNextClick}
                disabled={isClosed || queue.waitingList.length === 0}
                className={`px-4 py-2 rounded font-semibold text-sm text-white flex items-center space-x-1 transition-all shadow-sm active:scale-95 ${
                  isClosed || queue.waitingList.length === 0
                    ? 'bg-[#5865F2]/50 text-gray-300 cursor-not-allowed'
                    : 'bg-[#5865F2] hover:bg-[#4752c4] cursor-pointer'
                }`}
                title="Llamar al siguiente en espera"
              >
                <span>Siguiente</span>
              </button>

              <button
                onClick={onUndoTurn}
                disabled={isClosed || !queue.pastTurns || queue.pastTurns.length === 0}
                className={`px-4 py-2 rounded font-semibold text-sm text-white flex items-center space-x-1 transition-all shadow-sm active:scale-95 ${
                  isClosed || !queue.pastTurns || queue.pastTurns.length === 0
                    ? 'bg-[#4e5058]/50 text-gray-400 cursor-not-allowed'
                    : 'bg-[#4e5058] hover:bg-[#6d6f78] cursor-pointer'
                }`}
                title="Deshacer y regresar al turno anterior"
              >
                <span>Atrás</span>
              </button>
            </div>

            {/* Note to the user */}
            <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
              <span>💡</span>
              <span>
                En Discord real, los usuarios solo hacen click en los botones <strong>sin necesidad de escribir comandos</strong>.
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Modal for notes input */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#313338] text-white rounded-xl border border-gray-700 max-w-md w-full p-6 shadow-2xl animate-scaleUp">
            <h4 className="text-lg font-bold flex items-center gap-2 mb-1">
              <span>📝</span>
              <span>Unirse a la Cola</span>
            </h4>
            <p className="text-xs text-gray-300 mb-4">
              {queue.notesPrompt || 'Puedes agregar una nota opcional antes de ingresar.'}
            </p>

            <form onSubmit={handleModalSubmit}>
              <div className="mb-4">
                <label className="block text-xs uppercase font-bold text-gray-300 mb-1.5">
                  Información adicional / Identificador
                </label>
                <input
                  type="text"
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="Ej: GamerTag, Discord Tag, Tema..."
                  maxLength={50}
                  autoFocus
                  className="w-full bg-[#1e1f22] border border-gray-700 rounded-md p-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
                />
                <span className="text-[10px] text-gray-400 mt-1 block text-right">
                  {userNote.length}/50 caracteres
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-[#5865F2] hover:bg-[#4752c4] text-white rounded transition-colors"
                >
                  Confirmar e Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
