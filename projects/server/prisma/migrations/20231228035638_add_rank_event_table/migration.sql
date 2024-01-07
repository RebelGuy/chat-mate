-- CreateTable
CREATE TABLE `rank_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isAdded` BOOLEAN NOT NULL,
    `serialisedData` VARCHAR(8192) NULL,
    `streamerId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `rankId` INTEGER NOT NULL,

    INDEX `rank_event_time_key`(`time`),
    INDEX `rank_event_streamerId_key`(`streamerId`),
    INDEX `rank_event_userId_fkey`(`userId`),
    INDEX `rank_event_rankId_fkey`(`rankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rank_event` ADD CONSTRAINT `rank_event_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rank_event` ADD CONSTRAINT `rank_event_streamerId_key` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rank_event` ADD CONSTRAINT `rank_event_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
