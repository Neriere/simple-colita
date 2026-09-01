/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { QueueEvent, QueueMember } from './types/queue';
import { INITIAL_QUEUES, SIMULATED_PERSONAS } from './data/queuePresets';
import { soundManager } from './utils/audio';
import { DiscordQueueMessage } from './components/DiscordQueueMessage';
import { HostControlBar } from './components/HostControlBar';
import { CreateQueueModal } from './components/CreateQueueModal';
import { BotCodeExporter } from './components/BotCodeExporter';
import {
  Plus,
  Bot,
  MessageSquare,
  History,
  CheckCircle2
} from 'lucide-react';

export default function App() {
  const [queues, setQueues] = useState<QueueEvent[]>(() => {
    const saved = localStorage.getItem('discord_queues_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_QUEUES;
      }
    }
    return INITIAL_QUEUES;
  });

  const [activeQueueId, setActiveQueueId] = useState<string>(queues[0]?.id || 'queue-event-1');
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>('all');
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    role?: string;
  }>(SIMULATED_PERSONAS[0]);
  const [activeTab, setActiveTab] = useState<'simulator' | 'code'>('simulator');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Guardar en almacenamiento local
  useEffect(() => {
    localStorage.setItem('discord_queues_state', JSON.stringify(queues));
  }, [queues]);

  // Filtrado por canal/rango de niveles
  const filteredQueues = queues.filter((q) => {
    if (selectedChannelFilter === 'all') return true;
    if (selectedChannelFilter === 'low') {
      return (q.potionLevel && q.potionLevel <= 100) || q.channelName.includes('20-100');
    }
    if (selectedChannelFilter === 'high') {
      return (q.potionLevel && q.potionLevel > 100) || q.channelName.includes('110-200');
    }
    return true;
  });

  const activeQueue = queues.find((q) => q.id === activeQueueId) || filteredQueues[0] || queues[0];

  const handleJoinQueue = (note?: string) => {
    if (!activeQueue) return;

    setQueues((prev) =>
      prev.map((q) => {
        if (q.id !== activeQueue.id) return q;

        if (q.currentTurn.some((u) => u.id === currentUser.id) || q.waitingList.some((u) => u.id === currentUser.id)) {
          return q;
        }

        const newMember: QueueMember = {
          id: currentUser.id,
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatar: currentUser.avatar,
          joinedAt: Date.now(),
          status: 'waiting',
          note: note,
          role: currentUser.role,
        };

        const updatedWaiting = [...q.waitingList, newMember];
        let updatedTurn = [...q.currentTurn];

        if (updatedTurn.length < q.slotsPerTurn && updatedWaiting.length > 0) {
          const next = updatedWaiting.shift()!;
          next.status = 'in_progress';
          next.turnStartTime = Date.now();
          updatedTurn.push(next);
        }

        return {
          ...q,
          waitingList: updatedWaiting,
          currentTurn: updatedTurn,
        };
      })
    );
  };

  const handleLeaveQueue = () => {
    if (!activeQueue) return;

    setQueues((prev) =>
      prev.map((q) => {
        if (q.id !== activeQueue.id) return q;

        const updatedWaiting = q.waitingList.filter((u) => u.id !== currentUser.id);
        const wasInTurn = q.currentTurn.some((u) => u.id === currentUser.id);
        let updatedTurn = q.currentTurn.filter((u) => u.id !== currentUser.id);

        if (wasInTurn && updatedWaiting.length > 0) {
          const next = updatedWaiting.shift()!;
          next.status = 'in_progress';
          next.turnStartTime = Date.now();
          updatedTurn.push(next);
        }

        return {
          ...q,
          waitingList: updatedWaiting,
          currentTurn: updatedTurn,
        };
      })
    );
  };

  const handleAdvanceNext = () => {
    if (!activeQueue) return;

    setQueues((prev) =>
      prev.map((q) => {
        if (q.id !== activeQueue.id) return q;

        const completedMembers = q.currentTurn.map((u) => ({
          ...u,
          status: 'completed' as const,
          completedAt: Date.now(),
        }));

        const newPastTurns = [...(q.pastTurns || []), ...completedMembers];
        const newHistory = [...completedMembers, ...q.history];
        const newWaiting = [...q.waitingList];
        const newTurn: QueueMember[] = [];

        while (newTurn.length < q.slotsPerTurn && newWaiting.length > 0) {
          const next = newWaiting.shift()!;
          next.status = 'in_progress';
          next.turnStartTime = Date.now();
          newTurn.push(next);
        }

        return {
          ...q,
          currentTurn: newTurn,
          waitingList: newWaiting,
          pastTurns: newPastTurns,
          history: newHistory,
          lastAdvancedBy: { id: currentUser.id, username: currentUser.displayName },
        };
      })
    );
  };

  const handleUndoTurn = () => {
    if (!activeQueue || !activeQueue.history || activeQueue.history.length === 0) return;

    soundManager.playClick();

    setQueues((prev) =>
      prev.map((q) => {
        if (q.id !== activeQueue.id || q.history.length === 0) return q;

        const lastCompleted = q.history[0];
        const newHistory = q.history.slice(1);
        const newPastTurns = (q.pastTurns || []).slice(0, -1);
        const newWaiting = [...q.currentTurn, ...q.waitingList];

        const restoredTurn: QueueMember = {
          ...lastCompleted,
          status: 'in_progress',
          turnStartTime: Date.now(),
        };

        return {
          ...q,
          currentTurn: [restoredTurn],
          waitingList: newWaiting,
          pastTurns: newPastTurns,
          history: newHistory,
        };
      })
    );
  };

  const handleRemoveMember = (memberId: string) => {
    if (!activeQueue) return;

    setQueues((prev) =>
      prev.map((q) => {
        if (q.id !== activeQueue.id) return q;

        const wasInTurn = q.currentTurn.some((u) => u.id === memberId);
        const updatedWaiting = q.waitingList.filter((u) => u.id !== memberId);
        let updatedTurn = q.currentTurn.filter((u) => u.id !== memberId);

        if (wasInTurn && updatedWaiting.length > 0) {
          const next = updatedWaiting.shift()!;
          next.status = 'in_progress';
          next.turnStartTime = Date.now();
          updatedTurn.push(next);
        }

        return {
          ...q,
          waitingList: updatedWaiting,
          currentTurn: updatedTurn,
        };
      })
    );
  };

  const handleAddDummyMember = (customName?: string, customNote?: string) => {
    if (!activeQueue) return;

    const dummyNames = [
      'NightStalker_99',
      'PixelWarrior',
      'DragonSlayer',
      'CloudRider',
      'SamuraiJack',
      'AstroCoder',
      'GamerGirl_95',
      'ShadowHunter'
    ];
    const avatars = [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&auto=format&fit=crop&q=80',
    ];

    const randomName = customName || dummyNames[Math.floor(Math.random() * dummyNames.length)];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    const newMember: QueueMember = {
      id: `sim-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      username: randomName.toLowerCase(),
      displayName: randomName,
      avatar: randomAvatar,
      joinedAt: Date.now(),
      status: 'waiting',
      note: customNote || (Math.random() > 0.5 ? 'Deck Meta' : undefined),
    };

    setQueues((prev) =>
      prev.map((q) => {
        if (q.id !== activeQueue.id) return q;

        const updatedWaiting = [...q.waitingList, newMember];
        let updatedTurn = [...q.currentTurn];

        if (updatedTurn.length < q.slotsPerTurn && updatedWaiting.length > 0) {
          const next = updatedWaiting.shift()!;
          next.status = 'in_progress';
          next.turnStartTime = Date.now();
          updatedTurn.push(next);
        }

        return {
          ...q,
          waitingList: updatedWaiting,
          currentTurn: updatedTurn,
        };
      })
    );
  };

  const handleClearQueue = () => {
    if (!activeQueue) return;
    if (confirm('¿Vaciar los turnos actuales y la lista de espera de esta cola?')) {
      setQueues((prev) =>
        prev.map((q) =>
          q.id === activeQueue.id
            ? { ...q, currentTurn: [], waitingList: [], pastTurns: [], history: [], lastAdvancedBy: undefined }
            : q
        )
      );
    }
  };

  const handleShuffleQueue = () => {
    if (!activeQueue || activeQueue.waitingList.length <= 1) return;

    setQueues((prev) =>
      prev.map((q) => {
        if (q.id !== activeQueue.id) return q;
        const shuffled = [...q.waitingList].sort(() => Math.random() - 0.5);
        return {
          ...q,
          waitingList: shuffled,
        };
      })
    );
  };

  const handleCloseQueue = () => {
    if (!activeQueue) return;
    setQueues((prev) =>
      prev.map((q) =>
        q.id === activeQueue.id ? { ...q, isClosed: !q.isClosed } : q
      )
    );
  };

  const handleTogglePause = () => {
    if (!activeQueue) return;
    setQueues((prev) =>
      prev.map((q) =>
        q.id === activeQueue.id ? { ...q, isPaused: !q.isPaused } : q
      )
    );
  };

  const handleCreateNewQueue = (data: {
    title: string;
    description: string;
    maxCapacity: number;
    slotsPerTurn: number;
    turnTimeLimitMinutes: number;
    bannerUrl?: string;
  }) => {
    const newQueue: QueueEvent = {
      id: `queue-${Date.now()}`,
      title: data.title,
      description: data.description,
      maxCapacity: data.maxCapacity,
      slotsPerTurn: data.slotsPerTurn,
      turnTimeLimitMinutes: data.turnTimeLimitMinutes,
      bannerUrl: data.bannerUrl,
      isClosed: false,
      isPaused: false,
      hostId: currentUser.id,
      hostName: currentUser.displayName,
      createdAt: Date.now(),
      currentTurn: [],
      waitingList: [],
      pastTurns: [],
      history: [],
    };

    setQueues((prev) => [newQueue, ...prev]);
    setActiveQueueId(newQueue.id);
  };

  const handleDeleteQueue = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (queues.length <= 1) {
      alert('Debes mantener al menos una cola en la lista.');
      return;
    }
    if (confirm('¿Eliminar esta cola de la lista?')) {
      const remaining = queues.filter((q) => q.id !== id);
      setQueues(remaining);
      if (activeQueueId === id) {
        setActiveQueueId(remaining[0].id);
      }
    }
  };

  const handleExportCsv = () => {
    if (!activeQueue) return;
    const lines = [
      'Posicion,Nombre,Estado,Nota,FechaIngreso',
      ...activeQueue.currentTurn.map((u, i) => `Turno-${i + 1},"${u.displayName}",En Turno,"${u.note || ''}",${new Date(u.joinedAt).toLocaleString()}`),
      ...activeQueue.waitingList.map((u, i) => `Espera-${i + 1},"${u.displayName}",En Espera,"${u.note || ''}",${new Date(u.joinedAt).toLocaleString()}`),
      ...activeQueue.history.map((u) => `Completado,"${u.displayName}",Completado,"${u.note || ''}",${new Date(u.joinedAt).toLocaleString()}`),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cola-${activeQueue.title.toLowerCase().replace(/\s+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#1e1f22] text-gray-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-[#2b2d31] border-b border-[#202225] sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#5865F2] flex items-center justify-center text-white text-xl shadow-md">
              🎟️
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                <span>Discord Queue Bot</span>
              </h1>
              <p className="text-xs text-gray-400 hidden sm:block">
                Simulador de Mensajes y Exportador de Código para Discord
              </p>
            </div>
          </div>

          {/* Clean 2-tab navigation */}
          <nav className="flex items-center space-x-1.5 bg-[#1e1f22] p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-[#5865F2] text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Simulador de Discord</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-[#5865F2] text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Archivos &amp; Descarga (.ZIP)</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            {/* Top Queue Switcher & Channels Filter */}
            <div className="space-y-3 bg-[#2b2d31] p-4 rounded-xl border border-gray-800">
              {/* Canal Selector Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-700/60">
                <div className="flex items-center space-x-1.5 bg-[#1e1f22] p-1 rounded-lg border border-gray-700">
                  <button
                    onClick={() => setSelectedChannelFilter('all')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      selectedChannelFilter === 'all'
                        ? 'bg-[#5865F2] text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    🌐 Todas las Colas ({queues.length})
                  </button>
                  <button
                    onClick={() => setSelectedChannelFilter('low')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedChannelFilter === 'low'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-gray-400 hover:text-emerald-400'
                    }`}
                  >
                    <span>🎮 #recaudadores-20-100</span>
                    <span className="bg-black/30 text-[10px] px-1.5 py-0.2 rounded-full">
                      {queues.filter((q) => (q.potionLevel && q.potionLevel <= 100) || q.channelName.includes('20-100')).length}
                    </span>
                  </button>
                  <button
                    onClick={() => setSelectedChannelFilter('high')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedChannelFilter === 'high'
                        ? 'bg-pink-600 text-white shadow'
                        : 'text-gray-400 hover:text-pink-400'
                    }`}
                  >
                    <span>🔥 #recaudadores-110-200</span>
                    <span className="bg-black/30 text-[10px] px-1.5 py-0.2 rounded-full">
                      {queues.filter((q) => (q.potionLevel && q.potionLevel > 100) || q.channelName.includes('110-200')).length}
                    </span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-3.5 py-1.5 bg-[#248046] hover:bg-[#1a6334] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear Nueva Cola</span>
                  </button>
                </div>
              </div>

              {/* Horizontally scrollable Queue Cards */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 custom-scrollbar">
                {filteredQueues.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => setActiveQueueId(q.id)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all shrink-0 border ${
                      activeQueueId === q.id
                        ? 'bg-[#5865F2] text-white border-white/40 shadow'
                        : 'bg-[#1e1f22] text-gray-300 border-gray-700/60 hover:bg-[#35373c]'
                    }`}
                  >
                    {q.potionLevel && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          q.potionLevel <= 60
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : q.potionLevel <= 100
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : q.potionLevel <= 160
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-pink-500/20 text-pink-300'
                        }`}
                      >
                        Lv.{q.potionLevel}
                      </span>
                    )}
                    <span>{q.title}</span>
                    <span className="bg-black/30 text-[10px] px-1.5 py-0.2 rounded-full">
                      {q.waitingList.length + q.currentTurn.length}
                    </span>
                    {queues.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteQueue(q.id, e)}
                        className="text-gray-400 hover:text-red-400 ml-1"
                        title="Eliminar cola"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Grid with Discord Message Simulator + Host Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Discord Simulated Message (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <DiscordQueueMessage
                  queue={activeQueue}
                  currentUser={currentUser}
                  isHost={true}
                  onJoin={handleJoinQueue}
                  onLeave={handleLeaveQueue}
                  onAdvanceNext={handleAdvanceNext}
                  onUndoTurn={handleUndoTurn}
                  onRemoveMember={handleRemoveMember}
                  onCloseQueue={handleCloseQueue}
                  onTogglePause={handleTogglePause}
                />
              </div>

              {/* Right Column: Host Controls & History (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <HostControlBar
                  queue={activeQueue}
                  currentUser={currentUser}
                  onSwitchUser={setCurrentUser}
                  onAdvanceTurn={handleAdvanceNext}
                  onAddDummyMember={handleAddDummyMember}
                  onClearQueue={handleClearQueue}
                  onShuffleQueue={handleShuffleQueue}
                  onExportCsv={handleExportCsv}
                />

                {/* Queue History Card */}
                <div className="bg-[#2b2d31] rounded-xl border border-gray-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-emerald-400" />
                      <span>Turnos Pasados ({activeQueue.history.length})</span>
                    </h4>
                    {activeQueue.history.length > 0 && (
                      <button
                        onClick={() => {
                          setQueues((prev) =>
                            prev.map((q) => (q.id === activeQueue.id ? { ...q, history: [], pastTurns: [] } : q))
                          );
                        }}
                        className="text-[10px] text-gray-500 hover:text-red-400"
                      >
                        Limpiar Historial
                      </button>
                    )}
                  </div>

                  {activeQueue.history.length === 0 ? (
                    <div className="text-xs text-gray-500 italic py-3 text-center bg-[#1e1f22]/50 rounded">
                      Aún no hay turnos completados.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {activeQueue.history.map((member, idx) => (
                        <div
                          key={member.id + idx}
                          className="flex items-center justify-between bg-[#1e1f22] p-2 rounded text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-medium text-gray-200">{member.displayName}</span>
                            {member.note && (
                              <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
                                ({member.note})
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {member.completedAt
                              ? new Date(member.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Completado'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'code' && <BotCodeExporter />}
      </main>

      {/* Modal */}
      <CreateQueueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateNewQueue}
      />
    </div>
  );
}
