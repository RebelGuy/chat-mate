/*
  Warnings:

  - You are about to drop the column `isBroadcaster` on the `twitch_channel_global_info` table. All the data in the column will be lost.
  - You are about to drop the column `isMod` on the `twitch_channel_global_info` table. All the data in the column will be lost.
  - You are about to drop the column `isSubscriber` on the `twitch_channel_global_info` table. All the data in the column will be lost.
  - You are about to drop the column `isVip` on the `twitch_channel_global_info` table. All the data in the column will be lost.
  - You are about to drop the column `isModerator` on the `youtube_channel_global_info` table. All the data in the column will be lost.
  - You are about to drop the column `isOwner` on the `youtube_channel_global_info` table. All the data in the column will be lost.

*/

-- this is an imperfect migration. since we have no way of knowing which of the existing streamer data belongs to which streamer, we have to discard it.
-- all global data will remain the same.

-- AlterTable
ALTER TABLE `twitch_channel_global_info` DROP COLUMN `isBroadcaster`,
    DROP COLUMN `isMod`,
    DROP COLUMN `isSubscriber`,
    DROP COLUMN `isVip`;

-- AlterTable
ALTER TABLE `youtube_channel_global_info` DROP COLUMN `isModerator`,
    DROP COLUMN `isOwner`;

-- CreateTable
CREATE TABLE `youtube_channel_streamer_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isOwner` BOOLEAN NOT NULL,
    `isModerator` BOOLEAN NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `channelId` INTEGER NOT NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `youtube_channel_streamer_info_channelId_fkey`(`channelId`),
    INDEX `youtube_channel_streamer_info_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twitch_channel_streamer_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isBroadcaster` BOOLEAN NOT NULL,
    `isSubscriber` BOOLEAN NOT NULL,
    `isMod` BOOLEAN NOT NULL,
    `isVip` BOOLEAN NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `channelId` INTEGER NOT NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `twitch_channel_streamer_info_channelId_fkey`(`channelId`),
    INDEX `twitch_channel_streamer_info_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `youtube_channel_streamer_info` ADD CONSTRAINT `youtube_channel_streamer_info_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_channel_streamer_info` ADD CONSTRAINT `youtube_channel_streamer_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `youtube_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twitch_channel_streamer_info` ADD CONSTRAINT `twitch_channel_streamer_info_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twitch_channel_streamer_info` ADD CONSTRAINT `twitch_channel_streamer_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `twitch_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
