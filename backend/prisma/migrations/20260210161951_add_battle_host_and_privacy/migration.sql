/*
  Warnings:

  - Added the required column `hostId` to the `Battle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Battle" ADD COLUMN     "hostId" UUID NOT NULL,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BattleParticipant" ADD COLUMN     "isHost" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Battle_hostId_idx" ON "Battle"("hostId");

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
