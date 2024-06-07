-- CreateTable
CREATE TABLE `custom_rank_name` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(8) NOT NULL,
    `isActive` BOOLEAN NOT NULL,
    `userId` INTEGER NOT NULL,
    `rankId` INTEGER NOT NULL,
    `streamerId` INTEGER NULL,

    INDEX `custom_rank_name_userId_fkey`(`userId`),
    INDEX `custom_rank_name_rankId_fkey`(`rankId`),
    INDEX `custom_rank_name_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `custom_rank_name` ADD CONSTRAINT `custom_rank_name_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_rank_name` ADD CONSTRAINT `custom_rank_name_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_rank_name` ADD CONSTRAINT `custom_rank_name_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
