/*
  Warnings:

  - Added the required column `streamerId` to the `twitch_follower` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `twitch_follower` ADD COLUMN `streamerId` INTEGER NOT NULL DEFAULT 1;

-- remove defaults
ALTER TABLE `twitch_follower` ALTER `streamerId` DROP DEFAULT;


-- CreateIndex
CREATE INDEX `twitch_follower_streamerId_fkey` ON `twitch_follower`(`streamerId`);

-- AddForeignKey
ALTER TABLE `twitch_follower` ADD CONSTRAINT `twitch_follower_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
