-- youtube
RENAME TABLE `youtube_channel_info` TO `youtube_channel_global_info`;
ALTER TABLE `youtube_channel_global_info` RENAME INDEX `youtube_channel_info_channelId_fkey` TO `youtube_channel_global_info_channelId_fkey`;
ALTER TABLE `youtube_channel_global_info` RENAME INDEX `youtube_channel_info_time_key` TO `youtube_channel_global_info_time_key`;

-- rename foreign key
ALTER TABLE `youtube_channel_global_info` DROP FOREIGN KEY `youtube_channel_info_channelId_fkey`;
ALTER TABLE `youtube_channel_global_info` ADD CONSTRAINT `youtube_channel_global_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `youtube_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- twitch
RENAME TABLE `twitch_channel_info` TO `twitch_channel_global_info`;
ALTER TABLE `twitch_channel_global_info` RENAME INDEX `twitch_channel_info_channelId_fkey` TO `twitch_channel_global_info_channelId_fkey`;
ALTER TABLE `twitch_channel_global_info` RENAME INDEX `twitch_channel_info_time_key` TO `twitch_channel_global_info_time_key`;

-- rename foreign key
ALTER TABLE `twitch_channel_global_info` DROP FOREIGN KEY `twitch_channel_info_channelId_fkey`;
ALTER TABLE `twitch_channel_global_info` ADD CONSTRAINT `twitch_channel_global_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `twitch_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
