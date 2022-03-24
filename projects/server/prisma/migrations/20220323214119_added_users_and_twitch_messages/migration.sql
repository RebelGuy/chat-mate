/*
  Warnings:

  - You are about to drop the column `channelId` on the `chat_message` table. All the data in the column will be lost.
  - You are about to drop the column `adminChannelId` on the `experience_data_admin` table. All the data in the column will be lost.
  - You are about to drop the column `channelId` on the `experience_snapshot` table. All the data in the column will be lost.
  - You are about to drop the column `channelId` on the `experience_transaction` table. All the data in the column will be lost.
  - You are about to drop the column `channelId` on the `viewing_block` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cheerId]` on the table `chat_message_part` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Channel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platform` to the `chat_message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `chat_message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `adminUserId` to the `experience_data_admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `experience_snapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `experience_transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `twitchViewCount` to the `LiveViewers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `viewing_block` table without a default value. This is not possible if the table is not empty.

*/

-- CreateTable (no need to initialise)
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

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable (no need to initialise)
CREATE TABLE `twitch_channels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `twitchId` VARCHAR(32) NOT NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable (no need to initialise)
CREATE TABLE `chat_cheers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` INTEGER NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `colour` VARCHAR(8) NOT NULL,
    `imageUrl` VARCHAR(512) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable (this automatically defaults to 0)
ALTER TABLE `liveviewers` ADD COLUMN `twitchViewCount` INTEGER NOT NULL;

-- CreateTable (copy existing channels into this)
CREATE TABLE `chat_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `chat_users` (`id`) SELECT `id` FROM `channel`;


-- channel
ALTER TABLE `channel` ADD COLUMN `userId` INTEGER NOT NULL;
UPDATE `channel` SET `userId` = `id`;
ALTER TABLE `Channel` ADD CONSTRAINT `Channel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- experience_transaction
ALTER TABLE `experience_transaction` ADD COLUMN `userId` INTEGER NOT NULL;
UPDATE `experience_transaction` SET `userId` = `channelId`;
ALTER TABLE `experience_transaction` ADD CONSTRAINT `experience_transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `experience_transaction` DROP FOREIGN KEY `experience_transaction_channelId_fkey`;
ALTER TABLE `experience_transaction` DROP COLUMN `channelId`;

-- experience_snapshot
ALTER TABLE `experience_snapshot` ADD COLUMN `userId` INTEGER NOT NULL;
UPDATE `experience_snapshot` SET `userId` = `channelId`;
ALTER TABLE `experience_snapshot` ADD CONSTRAINT `experience_snapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `experience_snapshot` DROP FOREIGN KEY `experience_snapshot_channelId_fkey`;
ALTER TABLE `experience_snapshot` DROP COLUMN `channelId`;

-- viewing_block
ALTER TABLE `viewing_block` ADD COLUMN `userId` INTEGER NOT NULL;
UPDATE `viewing_block` SET `userId` = `channelId`;
ALTER TABLE `viewing_block` ADD CONSTRAINT `viewing_block_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `viewing_block` DROP FOREIGN KEY `viewing_block_channelId_fkey`;
ALTER TABLE `viewing_block` DROP COLUMN `channelId`;

-- experience_data_admin
ALTER TABLE `experience_data_admin` ADD COLUMN `adminUserId` INTEGER NOT NULL;
UPDATE `experience_data_admin` SET `adminUserId` = `adminChannelId`;
ALTER TABLE `experience_data_admin` ADD CONSTRAINT `experience_data_admin_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `experience_data_admin` DROP FOREIGN KEY `experience_data_admin_adminChannelId_fkey`;
ALTER TABLE `experience_data_admin` DROP COLUMN `adminChannelId`;

-- chat_message
ALTER TABLE `chat_message` ADD COLUMN `userId` INTEGER NOT NULL;
UPDATE `chat_message` SET `userId` = `channelId`;
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_channelId_fkey`;
ALTER TABLE `chat_message` DROP COLUMN `channelId`;
ALTER TABLE `chat_message` ADD COLUMN `platform` ENUM('YouTube', 'Twitch') NOT NULL;

-- AlterTable
ALTER TABLE `chat_message_part` ADD COLUMN `cheerId` INTEGER NULL;

-- AlterTable
ALTER TABLE `chat_text` MODIFY `text` VARCHAR(500) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `chat_message_part_cheerId_key` ON `chat_message_part`(`cheerId`);

-- AddForeignKey
ALTER TABLE `twitch_channel_info` ADD CONSTRAINT `twitch_channel_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `twitch_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twitch_channels` ADD CONSTRAINT `twitch_channels_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_cheerId_fkey` FOREIGN KEY (`cheerId`) REFERENCES `chat_cheers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
