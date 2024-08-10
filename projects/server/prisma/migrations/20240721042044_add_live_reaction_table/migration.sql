-- CreateTable
CREATE TABLE `live_reaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `count` INTEGER NOT NULL,
    `streamerId` INTEGER NOT NULL,
    `emojiId` INTEGER NOT NULL,

    INDEX `live_reaction_streamerId_fkey`(`streamerId`),
    INDEX `live_reaction_emojiId_fkey`(`emojiId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `live_reaction` ADD CONSTRAINT `live_reaction_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_reaction` ADD CONSTRAINT `live_reaction_emojiId_fkey` FOREIGN KEY (`emojiId`) REFERENCES `chat_emoji`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
