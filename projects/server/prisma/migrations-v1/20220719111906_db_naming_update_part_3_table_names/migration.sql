/*
  Warnings:

  - You are about to drop the `chat_cheers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customemoji` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `liveviewers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `punishments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `twitch_channels` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `twitch_followers` table. If the table is not empty, all the data it contains will be lost.

*/

-- chat_user
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_userId_fkey`;
ALTER TABLE `viewing_block` DROP FOREIGN KEY `viewing_block_userId_fkey`;
ALTER TABLE `experience_data_admin` DROP FOREIGN KEY `experience_data_admin_adminUserId_fkey`;
ALTER TABLE `experience_snapshot` DROP FOREIGN KEY `experience_snapshot_userId_fkey`;
ALTER TABLE `experience_transaction` DROP FOREIGN KEY `experience_transaction_userId_fkey`;
ALTER TABLE `punishments` DROP FOREIGN KEY `punishments_adminUserId_fkey`;
ALTER TABLE `punishments` DROP FOREIGN KEY `punishments_userId_fkey`;
ALTER TABLE `twitch_channels` DROP FOREIGN KEY `twitch_channels_userId_fkey`;
ALTER TABLE `youtube_channel` DROP FOREIGN KEY `youtube_channel_userId_fkey`;
RENAME TABLE `chat_users` TO `chat_user`;
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `viewing_block` ADD CONSTRAINT `viewing_block_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `experience_data_admin` ADD CONSTRAINT `experience_data_admin_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `experience_snapshot` ADD CONSTRAINT `experience_snapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `experience_transaction` ADD CONSTRAINT `experience_transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `youtube_channel` ADD CONSTRAINT `youtube_channel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- livestream
ALTER TABLE `livestream` RENAME INDEX `Livestream_liveId_key` TO `livestream_liveId_key`;

-- live_viewer
ALTER TABLE `liveviewers` DROP FOREIGN KEY `LiveViewers_livestreamId_fkey`;
RENAME TABLE `liveviewers` TO `live_viewer`;
ALTER TABLE `live_viewer` RENAME INDEX `LiveViewers_livestreamId_fkey` TO `live_viewer_livestreamId_fkey`;
ALTER TABLE `live_viewer` ADD CONSTRAINT `live_viewer_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- custom_emoji
ALTER TABLE `chat_custom_emoji` DROP FOREIGN KEY `chat_custom_emoji_customEmojiId_fkey`;
RENAME TABLE `customemoji` TO `custom_emoji`;
ALTER TABLE `custom_emoji` RENAME INDEX `CustomEmoji_symbol_key` TO `custom_emoji_symbol_key`;
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `custom_emoji`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- chat_cheer
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_cheerId_fkey`;
RENAME TABLE `chat_cheers` TO `chat_cheer`;
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_cheerId_fkey` FOREIGN KEY (`cheerId`) REFERENCES `chat_cheer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- twitch_channel
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_twitchChannelId_fkey`;
ALTER TABLE `twitch_channel_info` DROP FOREIGN KEY `twitch_channel_info_channelId_fkey`;
RENAME TABLE `twitch_channels` TO `twitch_channel`;
ALTER TABLE `twitch_channel` RENAME INDEX `twitch_channels_twitchId_key` TO `twitch_channel_twitchId_key`;
ALTER TABLE `twitch_channel` RENAME INDEX `twitch_channels_userId_fkey` TO `twitch_channel_userId_fkey`;
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_twitchChannelId_fkey` FOREIGN KEY (`twitchChannelId`) REFERENCES `twitch_channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `twitch_channel_info` ADD CONSTRAINT `twitch_channel_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `twitch_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- previously removed in the `chat_user` section
ALTER TABLE `twitch_channel` ADD CONSTRAINT `twitch_channel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- punishment
RENAME TABLE `punishments` to `punishment`;
ALTER TABLE `punishment` RENAME INDEX `punishments_userId_fkey` TO `punishment_userId_fkey`;
ALTER TABLE `punishment` RENAME INDEX `punishments_adminUserId_fkey` TO `punishment_adminUserId_fkey`;
-- previously removed in the `chat_user` section
ALTER TABLE `punishment` ADD CONSTRAINT `punishment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `punishment` ADD CONSTRAINT `punishment_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- twitch_follower
RENAME TABLE `twitch_followers` TO `twitch_follower`;
ALTER TABLE `twitch_follower` RENAME INDEX `twitch_followers_twitchId_key` TO `twitch_follower_twitchId_key`;
