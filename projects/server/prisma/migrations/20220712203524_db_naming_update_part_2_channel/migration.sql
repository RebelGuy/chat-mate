/*
  Warnings:

  - You are about to drop the `channel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `channel_info` table. If the table is not empty, all the data it contains will be lost.

*/

-- prep
ALTER TABLE `channel_info` DROP FOREIGN KEY `channel_info_channelId_fkey`;
ALTER TABLE `channel` DROP FOREIGN KEY `channel_userId_fkey`;

-- Channel -> YoutubeChannel
RENAME TABLE `channel` TO `youtube_channel`;
ALTER TABLE `youtube_channel` RENAME INDEX `Channel_youtubeId_key` TO `youtube_channel_youtubeId_key`;
ALTER TABLE `youtube_channel` RENAME INDEX `channel_userId_fkey` TO `youtube_channel_userId_fkey`;

-- ChannelInfo -> YoutubeChannelInfo
RENAME TABLE `channel_info` TO `youtube_channel_info`;
ALTER TABLE `youtube_channel_info` RENAME INDEX `channel_info_channelId_fkey` TO `youtube_channel_info_channelId_fkey`;

-- re-add
ALTER TABLE `youtube_channel` ADD CONSTRAINT `youtube_channel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `youtube_channel_info` ADD CONSTRAINT `youtube_channel_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `youtube_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
