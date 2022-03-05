-- DropForeignKey
ALTER TABLE `chat_custom_emoji` DROP FOREIGN KEY `chat_custom_emoji_textId_fkey`;

-- AlterTable
ALTER TABLE `chat_custom_emoji` ADD COLUMN `emojiId` INTEGER NULL,
    MODIFY `textId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_emojiId_fkey` FOREIGN KEY (`emojiId`) REFERENCES `chat_emoji`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_textId_fkey` FOREIGN KEY (`textId`) REFERENCES `chat_text`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
