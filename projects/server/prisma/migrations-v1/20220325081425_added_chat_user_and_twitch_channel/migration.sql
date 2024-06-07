/*
  Warnings:

  - A unique constraint covering the columns `[cheerId]` on the table `chat_message_part` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `channel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `twitchChannelId` to the `chat_message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `chat_message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `twitchViewCount` to the `liveviewers` table without a default value. This is not possible if the table is not empty.

*/

-- column modifications
ALTER TABLE `chat_text` MODIFY `text` VARCHAR(500) NOT NULL;
ALTER TABLE `liveviewers` ADD COLUMN `twitchViewCount` INTEGER NOT NULL;

-- chat_users
CREATE TABLE `chat_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `chat_users` (`id`) SELECT `id` FROM `channel`;


-- twitch_channels
CREATE TABLE `twitch_channels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `twitchId` VARCHAR(32) NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `twitch_channels_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `twitch_channels` ADD CONSTRAINT `twitch_channels_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- twitch_channel_info
CREATE TABLE `twitch_channel_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userName` VARCHAR(64) NOT NULL,
    `displayName` VARCHAR(64) NOT NULL,
    `userType` VARCHAR(32) NOT NULL,
    `isBroadcaster` BOOLEAN NOT NULL,
    `isSubscriber` BOOLEAN NOT NULL,
    `isMod` BOOLEAN NOT NULL,
    `isVip` BOOLEAN NOT NULL,
    `colour` VARCHAR(8) NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `channelId` INTEGER NOT NULL,

    INDEX `twitch_channel_info_channelId_fkey`(`channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `twitch_channel_info` ADD CONSTRAINT `twitch_channel_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `twitch_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- chat_cheers
CREATE TABLE `chat_cheers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` INTEGER NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `colour` VARCHAR(8) NOT NULL,
    `imageUrl` VARCHAR(512) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- channel
ALTER TABLE `channel` ADD COLUMN `userId` INTEGER NOT NULL;
UPDATE `channel` SET `userId` = `id`;
CREATE INDEX `channel_userId_fkey` ON `channel`(`userId`);
ALTER TABLE `channel` ADD CONSTRAINT `channel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- chat_message
ALTER TABLE `chat_message` ADD COLUMN `twitchChannelId` INTEGER NULL;
CREATE INDEX `chat_message_twitchChannelId_fkey` ON `chat_message`(`twitchChannelId`);
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_twitchChannelId_fkey` FOREIGN KEY (`twitchChannelId`) REFERENCES `twitch_channels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `chat_message` ADD COLUMN `userId` INTEGER NOT NULL;
UPDATE `chat_message` SET `userId` = `channelId`;
CREATE INDEX `chat_message_userId_fkey` ON `chat_message`(`userId`);
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- chat_message_part
ALTER TABLE `chat_message_part` ADD COLUMN `cheerId` INTEGER NULL;
CREATE UNIQUE INDEX `chat_message_part_cheerId_fkey` ON `chat_message_part`(`cheerId`);
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_cheerId_fkey` FOREIGN KEY (`cheerId`) REFERENCES `chat_cheers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
