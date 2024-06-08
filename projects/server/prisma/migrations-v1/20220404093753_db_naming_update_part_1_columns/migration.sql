/*
  Warnings:

  - You are about to drop the column `IsVerified` on the `channel_info` table. All the data in the column will be lost.
  - You are about to drop the column `youtubeId` on the `chat_emoji` table. All the data in the column will be lost.
  - You are about to drop the column `channelId` on the `chat_message` table. All the data in the column will be lost.
  - You are about to drop the column `youtubeId` on the `chat_message` table. All the data in the column will be lost.
  - You are about to drop the column `viewCount` on the `liveviewers` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[externalId]` on the table `chat_emoji` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `chat_message` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `isVerified` to the `channel_info` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalId` to the `chat_emoji` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalId` to the `chat_message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `youtubeViewCount` to the `liveviewers` table without a default value. This is not possible if the table is not empty.

*/

-- LiveViewers
ALTER TABLE `liveviewers` RENAME COLUMN `viewCount` TO `youtubeViewCount`;

-- ChannelInfo
ALTER TABLE `channel_info` RENAME COLUMN `IsVerified` TO `isVerified`;

-- TwitchChannel
ALTER TABLE `twitch_channels` RENAME INDEX `twich_channels_twitchId_key` TO `twitch_channels_twitchId_key`;

-- ChatEmoji
ALTER TABLE `chat_emoji` RENAME COLUMN `youtubeId` TO `externalId`;
ALTER TABLE `chat_emoji` RENAME INDEX `chat_emoji_youtubeId_key` TO `chat_emoji_externalId_key`;

-- ChatMessage
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_channelId_fkey`;
ALTER TABLE `chat_message` RENAME COLUMN `channelId` TO `youtubeChannelId`;
ALTER TABLE `chat_message` RENAME INDEX `chat_message_channelId_fkey` TO `chat_message_youtubeChannelId_fkey`;
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `chat_message` RENAME COLUMN `youtubeId` TO `externalId`;
ALTER TABLE `chat_message` RENAME INDEX `chat_message_youtubeId_key` TO `chat_message_externalId_key`;
