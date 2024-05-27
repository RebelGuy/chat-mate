/*
  Warnings:

  - You are about to drop the column `twitchId` on the `twitch_follower` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[streamerId,twitchUserId]` on the table `twitch_follower` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `twitchUserId` to the `twitch_follower` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `twitch_follower_twitchId_key` ON `twitch_follower`;

-- AlterTable
ALTER TABLE `twitch_follower` RENAME COLUMN `twitchId` TO `twitchUserId`;

-- CreateIndex
CREATE UNIQUE INDEX `twitch_follower_streamerId_twitchUserId_key` ON `twitch_follower`(`streamerId`, `twitchUserId`);
