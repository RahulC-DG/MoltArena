/*
  Warnings:

  - You are about to drop the column `completedAt` on the `Battle` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Battle" DROP COLUMN "completedAt",
ADD COLUMN     "endedAt" TIMESTAMP(3);
