-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('LOBBY', 'STARTING', 'IN_PROGRESS', 'VOTING', 'JUDGING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BattleMode" AS ENUM ('HEAD_TO_HEAD', 'TEAM', 'FREE_FOR_ALL');

-- CreateTable
CREATE TABLE "Agent" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "api_key_hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" UUID NOT NULL,
    "roomCode" VARCHAR(20) NOT NULL,
    "topic" VARCHAR(500) NOT NULL,
    "status" "BattleStatus" NOT NULL DEFAULT 'LOBBY',
    "mode" "BattleMode" NOT NULL DEFAULT 'HEAD_TO_HEAD',
    "maxParticipants" INTEGER NOT NULL DEFAULT 2,
    "turnDurationMs" INTEGER NOT NULL DEFAULT 30000,
    "maxTurns" INTEGER NOT NULL DEFAULT 10,
    "currentTurn" INTEGER NOT NULL DEFAULT 0,
    "enableJudge" BOOLEAN NOT NULL DEFAULT true,
    "enableCommentator" BOOLEAN NOT NULL DEFAULT true,
    "enableTTS" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "winnerId" UUID,
    "judgeReasoning" TEXT,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleParticipant" (
    "id" UUID NOT NULL,
    "battleId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "teamId" VARCHAR(50),
    "position" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BattleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleTurn" (
    "id" UUID NOT NULL,
    "battleId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "audioUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "commentary" TEXT,

    CONSTRAINT "BattleTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" UUID NOT NULL,
    "battleId" UUID NOT NULL,
    "voterId" UUID,
    "targetAgentId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentFeedback" (
    "id" UUID NOT NULL,
    "fromAgentId" UUID NOT NULL,
    "toAgentId" UUID NOT NULL,
    "battleId" UUID,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "sessionId" VARCHAR(255) NOT NULL,
    "agentId" UUID NOT NULL,
    "data" TEXT NOT NULL,
    "signature" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_name_key" ON "Agent"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_api_key_hash_key" ON "Agent"("api_key_hash");

-- CreateIndex
CREATE INDEX "Agent_name_idx" ON "Agent"("name");

-- CreateIndex
CREATE INDEX "Agent_isActive_idx" ON "Agent"("isActive");

-- CreateIndex
CREATE INDEX "Agent_createdAt_idx" ON "Agent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Battle_roomCode_key" ON "Battle"("roomCode");

-- CreateIndex
CREATE INDEX "Battle_roomCode_idx" ON "Battle"("roomCode");

-- CreateIndex
CREATE INDEX "Battle_status_idx" ON "Battle"("status");

-- CreateIndex
CREATE INDEX "Battle_createdAt_idx" ON "Battle"("createdAt");

-- CreateIndex
CREATE INDEX "Battle_status_createdAt_idx" ON "Battle"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Battle_status_mode_idx" ON "Battle"("status", "mode");

-- CreateIndex
CREATE INDEX "Battle_winnerId_idx" ON "Battle"("winnerId");

-- CreateIndex
CREATE INDEX "BattleParticipant_battleId_idx" ON "BattleParticipant"("battleId");

-- CreateIndex
CREATE INDEX "BattleParticipant_agentId_idx" ON "BattleParticipant"("agentId");

-- CreateIndex
CREATE INDEX "BattleParticipant_teamId_idx" ON "BattleParticipant"("teamId");

-- CreateIndex
CREATE INDEX "BattleParticipant_battleId_agentId_idx" ON "BattleParticipant"("battleId", "agentId");

-- CreateIndex
CREATE INDEX "BattleParticipant_battleId_position_idx" ON "BattleParticipant"("battleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BattleParticipant_battleId_agentId_key" ON "BattleParticipant"("battleId", "agentId");

-- CreateIndex
CREATE INDEX "BattleTurn_battleId_idx" ON "BattleTurn"("battleId");

-- CreateIndex
CREATE INDEX "BattleTurn_agentId_idx" ON "BattleTurn"("agentId");

-- CreateIndex
CREATE INDEX "BattleTurn_battleId_turnNumber_idx" ON "BattleTurn"("battleId", "turnNumber");

-- CreateIndex
CREATE INDEX "BattleTurn_createdAt_idx" ON "BattleTurn"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BattleTurn_battleId_turnNumber_key" ON "BattleTurn"("battleId", "turnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_idempotencyKey_key" ON "Vote"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Vote_battleId_idx" ON "Vote"("battleId");

-- CreateIndex
CREATE INDEX "Vote_voterId_idx" ON "Vote"("voterId");

-- CreateIndex
CREATE INDEX "Vote_targetAgentId_idx" ON "Vote"("targetAgentId");

-- CreateIndex
CREATE INDEX "Vote_battleId_voterId_idx" ON "Vote"("battleId", "voterId");

-- CreateIndex
CREATE INDEX "Vote_idempotencyKey_idx" ON "Vote"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_battleId_voterId_key" ON "Vote"("battleId", "voterId");

-- CreateIndex
CREATE INDEX "AgentFeedback_fromAgentId_idx" ON "AgentFeedback"("fromAgentId");

-- CreateIndex
CREATE INDEX "AgentFeedback_toAgentId_idx" ON "AgentFeedback"("toAgentId");

-- CreateIndex
CREATE INDEX "AgentFeedback_battleId_idx" ON "AgentFeedback"("battleId");

-- CreateIndex
CREATE INDEX "AgentFeedback_createdAt_idx" ON "AgentFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "AgentFeedback_toAgentId_rating_idx" ON "AgentFeedback"("toAgentId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionId_key" ON "Session"("sessionId");

-- CreateIndex
CREATE INDEX "Session_sessionId_idx" ON "Session"("sessionId");

-- CreateIndex
CREATE INDEX "Session_agentId_idx" ON "Session"("agentId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleTurn" ADD CONSTRAINT "BattleTurn_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleTurn" ADD CONSTRAINT "BattleTurn_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_targetAgentId_fkey" FOREIGN KEY ("targetAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentFeedback" ADD CONSTRAINT "AgentFeedback_fromAgentId_fkey" FOREIGN KEY ("fromAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentFeedback" ADD CONSTRAINT "AgentFeedback_toAgentId_fkey" FOREIGN KEY ("toAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentFeedback" ADD CONSTRAINT "AgentFeedback_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add CHECK constraints (CRITICAL Issue #6)
ALTER TABLE "Battle" ADD CONSTRAINT "check_max_participants" CHECK ("maxParticipants" > 0 AND "maxParticipants" <= 10);
ALTER TABLE "Battle" ADD CONSTRAINT "check_max_turns" CHECK ("maxTurns" > 0 AND "maxTurns" <= 100);
ALTER TABLE "AgentFeedback" ADD CONSTRAINT "check_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5);
