/*
  Warnings:

  - You are about to drop the column `platform` on the `chat_message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `chat_message` DROP COLUMN `platform`,
    ADD COLUMN `twitchChannelId` INTEGER NULL,
    ADD COLUMN `youtubeChannelId` INTEGER NULL;
UPDATE `chat_message` SET `youtubeChannelId` = `userId`;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `Channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_twitchChannelId_fkey` FOREIGN KEY (`twitchChannelId`) REFERENCES `twitch_channels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
