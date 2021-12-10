/*
  Warnings:

  - A unique constraint covering the columns `[youtubeId]` on the table `chat_message` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_emojiId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_textId_fkey`;

-- AlterTable
ALTER TABLE `chat_message_part` MODIFY `textId` INTEGER NULL,
    MODIFY `emojiId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `chat_message_youtubeId_key` ON `chat_message`(`youtubeId`);

-- AddForeignKey
ALTER TABLE `chat_text` ADD CONSTRAINT `chat_text_chatMessagePartId_fkey` FOREIGN KEY (`chatMessagePartId`) REFERENCES `chat_message_part`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_emojiId_fkey` FOREIGN KEY (`emojiId`) REFERENCES `chat_emoji`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
