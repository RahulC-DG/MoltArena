import { PrismaClient, Battle, BattleParticipant, BattleStatus, BattleMode } from '@prisma/client';
import { sanitizeInput } from '../utils/sanitize';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Room code generation constants
const ROOM_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude confusing chars (0/O, 1/I/L)
const ROOM_CODE_LENGTH = 6;

// Default battle configuration
const DEFAULT_MAX_PARTICIPANTS = 2;
const DEFAULT_TURN_DURATION_MS = 60000; // 1 minute
const DEFAULT_MAX_TURNS = 10;

export interface CreateBattleData {
  topic: string;
  mode?: BattleMode;
  maxParticipants?: number;
  turnDurationMs?: number;
  maxTurns?: number;
  isPrivate?: boolean;
  enableJudge?: boolean;
  enableCommentator?: boolean;
  enableTTS?: boolean;
}

export interface BattleFilters {
  status?: BattleStatus;
  mode?: BattleMode;
  isPrivate?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Generate a random room code using cryptographically secure randomness
 * Uses alphanumeric characters excluding confusing ones (0/O, 1/I/L)
 * Security: Uses crypto.randomInt() instead of Math.random() for unpredictable room codes
 */
export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const randomIndex = crypto.randomInt(0, ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS.charAt(randomIndex);
  }
  return code;
}

/**
 * Generate a unique room code by checking database
 * Retries up to 10 times if collision occurs
 */
export async function generateUniqueRoomCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateRoomCode();
    const existing = await prisma.battle.findUnique({
      where: { roomCode: code },
    });

    if (!existing) {
      return code;
    }

    attempts++;
  }

  throw new Error('Failed to generate unique room code after 10 attempts');
}

/**
 * Validate battle creation input
 */
function validateCreateBattleData(data: CreateBattleData): void {
  // Validate topic
  const topic = data.topic.trim();
  if (topic.length < 10 || topic.length > 500) {
    throw new Error('Topic must be between 10 and 500 characters');
  }

  // Validate maxParticipants
  if (data.maxParticipants !== undefined) {
    if (data.maxParticipants < 2 || data.maxParticipants > 10) {
      throw new Error('Max participants must be between 2 and 10');
    }
  }

  // Validate turnDurationMs
  if (data.turnDurationMs !== undefined) {
    if (data.turnDurationMs < 10000 || data.turnDurationMs > 300000) {
      throw new Error('Turn duration must be between 10000ms (10s) and 300000ms (5min)');
    }
  }

  // Validate maxTurns
  if (data.maxTurns !== undefined) {
    if (data.maxTurns < 1 || data.maxTurns > 100) {
      throw new Error('Max turns must be between 1 and 100');
    }
  }
}

/**
 * Create a new battle with the host as first participant
 */
export async function createBattle(
  data: CreateBattleData,
  hostId: string
): Promise<Battle> {
  // Validate input
  validateCreateBattleData(data);

  // Sanitize topic
  const sanitizedTopic = sanitizeInput(data.topic);

  // Generate unique room code
  const roomCode = await generateUniqueRoomCode();

  // Create battle with host as first participant
  const battle = await prisma.battle.create({
    data: {
      roomCode,
      topic: sanitizedTopic,
      status: BattleStatus.LOBBY,
      mode: data.mode || BattleMode.HEAD_TO_HEAD,
      maxParticipants: data.maxParticipants || DEFAULT_MAX_PARTICIPANTS,
      turnDurationMs: data.turnDurationMs || DEFAULT_TURN_DURATION_MS,
      maxTurns: data.maxTurns || DEFAULT_MAX_TURNS,
      isPrivate: data.isPrivate ?? false,
      enableJudge: data.enableJudge ?? true,
      enableCommentator: data.enableCommentator ?? true,
      enableTTS: data.enableTTS ?? true,
      hostId,
      participants: {
        create: {
          agentId: hostId,
          position: 0,
          isHost: true,
          isActive: true,
        },
      },
    },
    include: {
      participants: {
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  return battle;
}

/**
 * Get battle by ID with participants
 */
export async function getBattleById(battleId: string): Promise<Battle | null> {
  return prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        where: { isActive: true },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      },
      host: {
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      },
    },
  });
}

/**
 * List battles with filters
 */
export async function listBattles(
  filters: BattleFilters
): Promise<{ battles: Battle[]; total: number }> {
  const where: any = {};

  // Apply filters
  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.mode) {
    where.mode = filters.mode;
  }

  if (filters.isPrivate !== undefined) {
    where.isPrivate = filters.isPrivate;
  }

  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  // Get battles and total count
  const [battles, total] = await Promise.all([
    prisma.battle.findMany({
      where,
      include: {
        participants: {
          where: { isActive: true },
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
          },
        },
        host: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.battle.count({ where }),
  ]);

  return { battles, total };
}

/**
 * Check if an agent can join a battle
 */
export async function canJoinBattle(
  battleId: string,
  agentId: string
): Promise<{ canJoin: boolean; reason?: string }> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        where: { isActive: true },
      },
    },
  });

  if (!battle) {
    return { canJoin: false, reason: 'Battle not found' };
  }

  // Can only join battles in LOBBY state
  if (battle.status !== BattleStatus.LOBBY) {
    return { canJoin: false, reason: 'Battle is not in lobby state' };
  }

  // Check if already a participant
  const existingParticipant = battle.participants.find(
    (p) => p.agentId === agentId
  );
  if (existingParticipant) {
    return { canJoin: false, reason: 'Already in this battle' };
  }

  // Check capacity
  if (battle.participants.length >= battle.maxParticipants) {
    return { canJoin: false, reason: 'Battle is full' };
  }

  return { canJoin: true };
}

/**
 * Join a battle as a participant
 */
export async function joinBattle(
  battleId: string,
  agentId: string
): Promise<BattleParticipant> {
  // Check if can join
  const check = await canJoinBattle(battleId, agentId);
  if (!check.canJoin) {
    throw new Error(check.reason || 'Cannot join battle');
  }

  // Get current participant count for position
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        where: { isActive: true },
      },
    },
  });

  if (!battle) {
    throw new Error('Battle not found');
  }

  // Create participant
  const participant = await prisma.battleParticipant.create({
    data: {
      battleId,
      agentId,
      position: battle.participants.length,
      isActive: true,
    },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      },
    },
  });

  return participant;
}

/**
 * Check if an agent is the host of a battle
 */
export async function isHost(battleId: string, agentId: string): Promise<boolean> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    select: { hostId: true },
  });

  return battle?.hostId === agentId;
}

/**
 * Leave a battle
 * If host leaves a LOBBY battle, cancel it
 */
export async function leaveBattle(
  battleId: string,
  agentId: string
): Promise<void> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        where: { isActive: true },
      },
    },
  });

  if (!battle) {
    throw new Error('Battle not found');
  }

  // Can only leave from LOBBY
  if (battle.status !== BattleStatus.LOBBY) {
    throw new Error('Can only leave battles in lobby state');
  }

  // Check if participant
  const participant = battle.participants.find((p) => p.agentId === agentId);
  if (!participant) {
    throw new Error('Not a participant in this battle');
  }

  // If host leaves, cancel the battle
  if (battle.hostId === agentId) {
    await prisma.battle.update({
      where: { id: battleId },
      data: { status: BattleStatus.CANCELLED },
    });
  } else {
    // Mark participant as inactive
    await prisma.battleParticipant.update({
      where: {
        battleId_agentId: {
          battleId,
          agentId,
        },
      },
      data: { isActive: false },
    });
  }
}

/**
 * Start a battle (host only)
 * Transitions from LOBBY to STARTING
 */
export async function startBattle(
  battleId: string,
  hostId: string
): Promise<Battle> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        where: { isActive: true },
      },
    },
  });

  if (!battle) {
    throw new Error('Battle not found');
  }

  // Verify host
  if (battle.hostId !== hostId) {
    throw new Error('Only the host can start the battle');
  }

  // Can only start from LOBBY
  if (battle.status !== BattleStatus.LOBBY) {
    throw new Error('Battle must be in lobby state to start');
  }

  // Check minimum participants (at least 2 for HEAD_TO_HEAD)
  const minParticipants = battle.mode === BattleMode.HEAD_TO_HEAD ? 2 : 2;
  if (battle.participants.length < minParticipants) {
    throw new Error(`Need at least ${minParticipants} participants to start`);
  }

  // Update battle status to STARTING
  const updatedBattle = await prisma.battle.update({
    where: { id: battleId },
    data: { status: BattleStatus.STARTING },
    include: {
      participants: {
        where: { isActive: true },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      },
      host: {
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      },
    },
  });

  return updatedBattle;
}

/**
 * Cancel a battle (host only)
 * Can cancel from LOBBY or STARTING states
 */
export async function cancelBattle(
  battleId: string,
  hostId: string
): Promise<Battle> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
  });

  if (!battle) {
    throw new Error('Battle not found');
  }

  // Verify host
  if (battle.hostId !== hostId) {
    throw new Error('Only the host can cancel the battle');
  }

  // Can only cancel from LOBBY or STARTING
  if (battle.status !== BattleStatus.LOBBY && battle.status !== BattleStatus.STARTING) {
    throw new Error('Can only cancel battles in lobby or starting state');
  }

  // Update battle status to CANCELLED
  const updatedBattle = await prisma.battle.update({
    where: { id: battleId },
    data: { status: BattleStatus.CANCELLED },
    include: {
      participants: {
        where: { isActive: true },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      },
      host: {
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      },
    },
  });

  return updatedBattle;
}
