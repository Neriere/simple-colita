import { PresetTemplate, QueueEvent } from '../types/queue';

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'recaudador_low',
    title: 'Recaudador Zona 20-60 (Inicial)',
    description: 'Cola para defensa/ataque de recaudadores en zonas de nivel 20 a 60. Requiere poción nivel 20 a 60.',
    slotsPerTurn: 1,
    maxCapacity: 15,
    turnTimeLimitMinutes: 10,
    allowNotes: true,
    notesPrompt: 'Nombre de PJ / Nivel / Clase',
    colorHex: '#57F287',
    icon: 'Shield',
    potionLevel: 40,
    zoneCategory: '20-100',
  },
  {
    id: 'recaudador_mid',
    title: 'Recaudador Zona 80-100 (Intermedio)',
    description: 'Cola para recaudadores en zonas 80 a 100. Pociones nivel 80 y 100.',
    slotsPerTurn: 1,
    maxCapacity: 20,
    turnTimeLimitMinutes: 10,
    allowNotes: true,
    notesPrompt: 'Clase / Elemento / Nivel',
    colorHex: '#5865F2',
    icon: 'Shield',
    potionLevel: 100,
    zoneCategory: '20-100',
  },
  {
    id: 'recaudador_high',
    title: 'Recaudador Zona 120-160 (Avanzado)',
    description: 'Defensa de recaudadores de nivel 120, 140 y 160. Coordinación con gremio.',
    slotsPerTurn: 1,
    maxCapacity: 25,
    turnTimeLimitMinutes: 12,
    allowNotes: true,
    notesPrompt: 'Set / Nivel / Rol (Tanque/Daño)',
    colorHex: '#FEE75C',
    icon: 'Shield',
    potionLevel: 140,
    zoneCategory: '110-200',
  },
  {
    id: 'recaudador_endgame',
    title: 'Recaudador Zona 180-200 (Épico/Endgame)',
    description: 'Cola prioritaria para zonas 180 y Mazmorras nivel 200. Pociones nivel 180-200.',
    slotsPerTurn: 1,
    maxCapacity: 30,
    turnTimeLimitMinutes: 15,
    allowNotes: true,
    notesPrompt: 'Rol / Iniciativa / Poción Lista',
    colorHex: '#EB459E',
    icon: 'Flame',
    potionLevel: 200,
    zoneCategory: '110-200',
  },
  {
    id: 'gaming_1v1',
    title: 'Torneo 1v1 / Duelos PvP',
    description: 'Únete para desafiar al host o participar en la rotación de partidas 1 vs 1.',
    slotsPerTurn: 1,
    maxCapacity: 20,
    turnTimeLimitMinutes: 10,
    allowNotes: true,
    notesPrompt: 'Indica tu GamerTag o Rango',
    colorHex: '#5865F2',
    icon: 'Gamepad2',
  },
  {
    id: 'custom_party',
    title: 'Mazmorra Squad (Grupos de 4)',
    description: 'Rotación de escuadrones para pasar mazmorras juntos. Entran 4 jugadores por ronda.',
    slotsPerTurn: 4,
    maxCapacity: 32,
    turnTimeLimitMinutes: 20,
    allowNotes: true,
    notesPrompt: 'Tu ID / Clase',
    colorHex: '#9B59B6',
    icon: 'Users',
    potionLevel: 200,
  }
];

export const INITIAL_QUEUES: QueueEvent[] = [
  {
    id: 'queue-event-1',
    title: 'Recaudador Llanura de Cania',
    description: 'Defensa de recaudador en Llanura de Cania. ¡Anotarse con poción nivel 60 en mano!',
    channelName: '🎮・recaudadores-20-100',
    hostName: 'CapitanGremio#1234',
    hostAvatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
    createdAt: Date.now() - 1000 * 60 * 18,
    status: 'active',
    maxCapacity: 15,
    slotsPerTurn: 1,
    turnTimeLimitMinutes: 8,
    allowNotes: true,
    notesPrompt: 'Tu Clase / Nivel',
    autoAdvance: false,
    colorHex: '#57F287',
    potionLevel: 60,
    zoneCategory: '20-100',
    currentTurn: [
      {
        id: 'user-001',
        username: 'ViperStrike',
        displayName: 'Yopuka_Fuego (Lv. 60)',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        joinedAt: Date.now() - 1000 * 60 * 12,
        turnStartTime: Date.now() - 1000 * 60 * 3,
        status: 'in_progress',
        note: 'Poción Lv. 60 lista',
        role: 'Jugador'
      }
    ],
    waitingList: [
      {
        id: 'user-002',
        username: 'CyberKitten',
        displayName: 'Ocra_Criticos ✨',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        joinedAt: Date.now() - 1000 * 60 * 9,
        status: 'waiting',
        note: 'Poción Lv. 60',
        role: 'VIP'
      },
      {
        id: 'user-003',
        username: 'AlexCode',
        displayName: 'Sacrógrito_Tanque ⚡',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
        joinedAt: Date.now() - 1000 * 60 * 6,
        status: 'waiting',
        note: 'Poción Lista'
      }
    ],
    history: [
      {
        id: 'user-prev-1',
        username: 'NeoMatrix',
        displayName: 'Aniripsa_Curador 🕶️',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        joinedAt: Date.now() - 1000 * 60 * 25,
        completedAt: Date.now() - 1000 * 60 * 12,
        status: 'completed',
        note: 'Turno finalizado'
      }
    ]
  },
  {
    id: 'queue-event-2',
    title: 'Recaudador Mazmorra Conde Kontatrás',
    description: 'Cola para defensa en Frigost 3 (Zona 200). Pociones nivel 200 obligatorias.',
    channelName: '🔥・recaudadores-110-200',
    hostName: 'LiderFrigost#5555',
    hostAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    createdAt: Date.now() - 1000 * 60 * 35,
    status: 'active',
    maxCapacity: 25,
    slotsPerTurn: 1,
    turnTimeLimitMinutes: 15,
    allowNotes: true,
    notesPrompt: 'Rol / Iniciativa',
    autoAdvance: false,
    colorHex: '#EB459E',
    potionLevel: 200,
    zoneCategory: '110-200',
    currentTurn: [
      {
        id: 'user-200-1',
        username: 'PandawaGod',
        displayName: 'Panda_Posicionador (Lv. 200)',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
        joinedAt: Date.now() - 1000 * 60 * 20,
        turnStartTime: Date.now() - 1000 * 60 * 5,
        status: 'in_progress',
        note: 'Poción Lv. 200 lista',
        role: 'VIP'
      }
    ],
    waitingList: [
      {
        id: 'user-200-2',
        username: 'FecaImmortal',
        displayName: 'Feca_Escudos 🛡️',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        joinedAt: Date.now() - 1000 * 60 * 15,
        status: 'waiting',
        note: 'Poción Lv. 200'
      }
    ],
    history: []
  }
];

export const SIMULATED_PERSONAS = [
  {
    id: 'user-self',
    username: 'Diego_User',
    displayName: 'Diego (Tú)',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    role: 'Miembro'
  },
  {
    id: 'user-guest-1',
    username: 'Sofia_Gamer',
    displayName: 'Sofia 🎮',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'Miembro'
  },
  {
    id: 'user-guest-2',
    username: 'Carlos_Pro',
    displayName: 'Carlos #007',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'VIP'
  },
  {
    id: 'user-guest-3',
    username: 'Valen_Streamer',
    displayName: 'ValenLive 🟣',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    role: 'Streamer'
  }
];
