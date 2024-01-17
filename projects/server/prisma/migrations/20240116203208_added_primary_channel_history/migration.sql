/*
  Warnings:

  - Added the required column `timeAdded` to the `streamer_twitch_channel_link` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timeAdded` to the `streamer_youtube_channel_link` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `streamer_twitch_channel_link` ADD COLUMN `timeAdded` DATETIME(3) NULL,
    ADD COLUMN `timeRemoved` DATETIME(3) NULL;
UPDATE `streamer_twitch_channel_link` SET `timeAdded` = '1000-01-01 00:00:00.000000' WHERE `id` > 0;
ALTER TABLE `streamer_twitch_channel_link` ALTER COLUMN `timeAdded` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `streamer_youtube_channel_link` ADD COLUMN `timeAdded` DATETIME(3) NULL,
    ADD COLUMN `timeRemoved` DATETIME(3) NULL;
UPDATE `streamer_youtube_channel_link` SET `timeAdded` = '1000-01-01 00:00:00.000000' WHERE `id` > 0;
ALTER TABLE `streamer_youtube_channel_link` ALTER COLUMN `timeAdded` DATETIME(3) NOT NULL;

-- CreateIndex
CREATE INDEX `streamer_twitch_channel_link_streamerId_fkey` ON `streamer_twitch_channel_link`(`streamerId`);

-- CreateIndex
CREATE INDEX `streamer_twitch_channel_link_twitchChannelId_fkey` ON `streamer_twitch_channel_link`(`twitchChannelId`);

-- CreateIndex
CREATE INDEX `streamer_youtube_channel_link_streamerId_fkey` ON `streamer_youtube_channel_link`(`streamerId`);

-- CreateIndex
CREATE INDEX `streamer_youtube_channel_link_youtubeChannelId_fkey` ON `streamer_youtube_channel_link`(`youtubeChannelId`);
