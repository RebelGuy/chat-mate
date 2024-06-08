/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `twitch_channel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `youtube_channel` will be added. If there are existing duplicate values, this will fail.

*/

-- all we want to do is add a unique constraint on an existing index. since that index is already a foreign key, we have to remove everything first and then re-apply.

ALTER TABLE `twitch_channel` DROP FOREIGN KEY `twitch_channel_userId_fkey`;
ALTER TABLE `youtube_channel` DROP FOREIGN KEY `youtube_channel_userId_fkey`;

DROP INDEX `twitch_channel_userId_fkey` ON `twitch_channel`;
DROP INDEX `youtube_channel_userId_fkey` ON `youtube_channel`;

ALTER TABLE `twitch_channel` ADD CONSTRAINT `twitch_channel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `youtube_channel` ADD CONSTRAINT `youtube_channel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX `twitch_channel_userId_fkey` ON `twitch_channel`(`userId`);
CREATE UNIQUE INDEX `youtube_channel_userId_fkey` ON `youtube_channel`(`userId`);
