export interface QueueMember {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  joinedAt: number;
  status: 'waiting' | 'in_progress' | 'completed' | 'skipped';
  note?: string;
  turnStartTime?: number;
  completedAt?: number;
  role?: string;
}

export interface QueueEvent {
  id: string;
  title: string;
  description: string;
  channelName?: string;
  hostId?: string;
  hostName: string;
  hostAvatar?: string;
  createdAt: number;
  status?: 'active' | 'paused' | 'closed';
  maxCapacity: number; // 0 for unlimited
  slotsPerTurn: number; // usually 1 or 2
  turnTimeLimitMinutes: number; // 0 for unlimited
  allowNotes?: boolean;
  notesPrompt?: string;
  notifyRole?: string;
  autoAdvance?: boolean;
  colorHex?: string;
  currentTurn: QueueMember[];
  waitingList: QueueMember[];
  history: QueueMember[];
  pastTurns?: QueueMember[];
  lastAdvancedBy?: { id: string; username: string };
  iconUrl?: string | null;
  bannerUrl?: string | null;
  isClosed?: boolean;
  isPaused?: boolean;
  potionLevel?: number | null; // 20, 40, 60, 80, 100, 120, 140, 160, 180, 200
  zoneCategory?: string | null; // '20-100' | '110-200'
}

export interface PresetTemplate {
  id: string;
  title: string;
  description: string;
  slotsPerTurn: number;
  maxCapacity: number;
  turnTimeLimitMinutes: number;
  allowNotes: boolean;
  notesPrompt: string;
  colorHex: string;
  icon: string;
  potionLevel?: number;
  zoneCategory?: string;
}
