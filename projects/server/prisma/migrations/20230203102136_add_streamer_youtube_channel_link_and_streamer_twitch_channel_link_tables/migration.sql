-- CreateTable
CREATE TABLE `streameryoutubechannellink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `streamerId` INTEGER NOT NULL,
    `youtubeChannelId` INTEGER NOT NULL,

    UNIQUE INDEX `streamer_youtube_channel_link_streamerId_fkey`(`streamerId`),
    UNIQUE INDEX `streamer_youtube_channel_link_youtubeChannelId_fkey`(`youtubeChannelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `streamertwitchchannellink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `streamerId` INTEGER NOT NULL,
    `twitchChannelId` INTEGER NOT NULL,

    UNIQUE INDEX `streamer_twitch_channel_link_streamerId_fkey`(`streamerId`),
    UNIQUE INDEX `streamer_twitch_channel_link_twitchChannelId_fkey`(`twitchChannelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `streameryoutubechannellink` ADD CONSTRAINT `streamer_youtube_channel_link_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streameryoutubechannellink` ADD CONSTRAINT `streamer_youtube_channel_link_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `youtube_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamertwitchchannellink` ADD CONSTRAINT `streamer_twitch_channel_link_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamertwitchchannellink` ADD CONSTRAINT `streamer_twitch_channel_link_twitchChannelId_fkey` FOREIGN KEY (`twitchChannelId`) REFERENCES `twitch_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
