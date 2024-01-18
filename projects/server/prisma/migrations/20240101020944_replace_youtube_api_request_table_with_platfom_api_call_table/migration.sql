/*
  Warnings:

  - You are about to drop the `youtube_api_request` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `rank_event` DROP FOREIGN KEY `rank_event_streamerId_key`;

-- DropForeignKey
ALTER TABLE `youtube_api_request` DROP FOREIGN KEY `youtube_api_request_streamerId_fkey`;

-- DropTable
DROP TABLE `youtube_api_request`;

-- CreateTable
CREATE TABLE `platform_api_call` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `platform` VARCHAR(16) NOT NULL,
    `endpoint` VARCHAR(128) NOT NULL,
    `payload` VARCHAR(1024) NULL,
    `error` VARCHAR(1024) NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `platform_api_call_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rank_event` ADD CONSTRAINT `rank_event_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_api_call` ADD CONSTRAINT `platform_api_call_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `rank_event` RENAME INDEX `rank_event_streamerId_key` TO `rank_event_streamerId_fkey`;
