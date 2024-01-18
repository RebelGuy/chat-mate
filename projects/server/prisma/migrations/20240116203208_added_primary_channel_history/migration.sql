/*
  Warnings:

  - Added the required column `timeAdded` to the `streamer_twitch_channel_link` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timeAdded` to the `streamer_youtube_channel_link` table without a default value. This is not possible if the table is not empty.

*/

-- AlterTable
ALTER TABLE `streamer_youtube_channel_link` ADD COLUMN `timeAdded` DATETIME(3) NULL,
    ADD COLUMN `timeRemoved` DATETIME(3) NULL;
UPDATE `streamer_youtube_channel_link` SET `timeAdded` = '1000-01-01 00:00:00.000000' WHERE `id` > 0;
ALTER TABLE `streamer_youtube_channel_link` MODIFY COLUMN `timeAdded` DATETIME(3) NOT NULL;

-- convert unique index to non-unique index - the only way is to drop it and re-add it, including the foreign keys :  ---  (
ALTER TABLE `streamer_youtube_channel_link` DROP FOREIGN KEY `streamer_youtube_channel_link_streamerId_fkey`;
ALTER TABLE `streamer_youtube_channel_link` DROP FOREIGN KEY `streamer_youtube_channel_link_youtubeChannelId_fkey`;

ALTER TABLE `streamer_youtube_channel_link` DROP INDEX `streamer_youtube_channel_link_streamerId_fkey`;
ALTER TABLE `streamer_youtube_channel_link` DROP INDEX `streamer_youtube_channel_link_youtubeChannelId_fkey`;

ALTER TABLE `streamer_youtube_channel_link` ADD INDEX `streamer_youtube_channel_link_streamerId_fkey` (`streamerId` ASC) VISIBLE;
ALTER TABLE `streamer_youtube_channel_link` ADD INDEX `streamer_youtube_channel_link_youtubeChannelId_fkey` (`youtubeChannelId` ASC) VISIBLE;

ALTER TABLE `streamer_youtube_channel_link` ADD CONSTRAINT `streamer_youtube_channel_link_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `streamer_youtube_channel_link` ADD CONSTRAINT `streamer_youtube_channel_link_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `youtube_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE `streamer_twitch_channel_link` ADD COLUMN `timeAdded` DATETIME(3) NULL,
    ADD COLUMN `timeRemoved` DATETIME(3) NULL;
UPDATE `streamer_twitch_channel_link` SET `timeAdded` = '1000-01-01 00:00:00.000000' WHERE `id` > 0;
ALTER TABLE `streamer_twitch_channel_link` MODIFY COLUMN `timeAdded` DATETIME(3) NOT NULL;

-- convert unique index to non-unique index - the only way is to drop it and re-add it, including the foreign keys :  ---  (
ALTER TABLE `streamer_twitch_channel_link` DROP FOREIGN KEY `streamer_twitch_channel_link_streamerId_fkey`;
ALTER TABLE `streamer_twitch_channel_link` DROP FOREIGN KEY `streamer_twitch_channel_link_twitchChannelId_fkey`;

ALTER TABLE `streamer_twitch_channel_link` DROP INDEX `streamer_twitch_channel_link_streamerId_fkey`;
ALTER TABLE `streamer_twitch_channel_link` DROP INDEX `streamer_twitch_channel_link_twitchChannelId_fkey`;

ALTER TABLE `streamer_twitch_channel_link` ADD INDEX `streamer_twitch_channel_link_streamerId_fkey` (`streamerId` ASC) VISIBLE;
ALTER TABLE `streamer_twitch_channel_link` ADD INDEX `streamer_twitch_channel_link_twitchChannelId_fkey` (`twitchChannelId` ASC) VISIBLE;

ALTER TABLE `streamer_twitch_channel_link` ADD CONSTRAINT `streamer_twitch_channel_link_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `streamer_twitch_channel_link` ADD CONSTRAINT `streamer_twitch_channel_link_twitchChannelId_fkey` FOREIGN KEY (`twitchChannelId`) REFERENCES `twitch_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
