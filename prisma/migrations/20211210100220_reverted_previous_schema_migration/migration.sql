-- DropForeignKey
ALTER TABLE `chat_text` DROP FOREIGN KEY `chat_text_chatMessagePartId_fkey`;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_textId_fkey` FOREIGN KEY (`textId`) REFERENCES `chat_text`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
