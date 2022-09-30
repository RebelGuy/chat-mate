-- CreateTable
CREATE TABLE `custom_emoji_rank_whitelist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customEmojiId` INTEGER NOT NULL,
    `rankId` INTEGER NOT NULL,

    UNIQUE INDEX `custom_emoji_rank_whitelist_customEmojiId_rankId_key`(`customEmojiId`, `rankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `custom_emoji_rank_whitelist` ADD CONSTRAINT `custom_emoji_rank_whitelist_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `custom_emoji`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_emoji_rank_whitelist` ADD CONSTRAINT `custom_emoji_rank_whitelist_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
