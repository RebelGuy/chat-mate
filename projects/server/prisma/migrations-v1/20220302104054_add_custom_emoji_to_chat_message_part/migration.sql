-- AlterTable
ALTER TABLE `chat_message_part` ADD COLUMN `customEmojiId` INTEGER NULL;

-- CreateTable
CREATE TABLE `chat_custom_emoji` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `textId` INTEGER NOT NULL,
    `customEmojiId` INTEGER NOT NULL,

    UNIQUE INDEX `chat_custom_emoji_textId_key`(`textId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_textId_fkey` FOREIGN KEY (`textId`) REFERENCES `chat_text`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `customemoji`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `chat_custom_emoji`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
