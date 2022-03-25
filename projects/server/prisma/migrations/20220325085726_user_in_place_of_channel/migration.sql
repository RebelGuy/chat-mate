/*
  Warnings:

  - You are about to drop the column `adminChannelId` on the `experience_data_admin` table. All the data in the column will be lost.
  - You are about to drop the column `channelId` on the `experience_snapshot` table. All the data in the column will be lost.
  - You are about to drop the column `channelId` on the `experience_transaction` table. All the data in the column will be lost.
  - You are about to drop the column `channelId` on the `viewing_block` table. All the data in the column will be lost.
  - Added the required column `adminUserId` to the `experience_data_admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `experience_snapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `experience_transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `viewing_block` table without a default value. This is not possible if the table is not empty.

*/

-- experience_data_admin
ALTER TABLE `experience_data_admin` ADD COLUMN `adminUserId` INTEGER NOT NULL;
UPDATE `experience_data_admin` SET `adminUserId` = `adminChannelId`;
CREATE INDEX `experience_data_admin_adminUserId_fkey` ON `experience_data_admin`(`adminUserId`);
ALTER TABLE `experience_data_admin` ADD CONSTRAINT `experience_data_admin_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `experience_data_admin` DROP FOREIGN KEY `experience_data_admin_adminChannelId_fkey`;
ALTER TABLE `experience_data_admin` DROP COLUMN `adminChannelId`;

-- experience_snapshot
ALTER TABLE `experience_snapshot` ADD COLUMN `userId` INTEGER NOT NULL;
UPDATE `experience_snapshot` SET `userId` = `channelId`;
CREATE INDEX `experience_snapshot_userId_fkey` ON `experience_snapshot`(`userId`);
ALTER TABLE `experience_snapshot` ADD CONSTRAINT `experience_snapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `experience_snapshot` DROP FOREIGN KEY `experience_snapshot_channelId_fkey`;
ALTER TABLE `experience_snapshot` DROP COLUMN `channelId`;

-- experience_transaction
ALTER TABLE `experience_transaction` ADD COLUMN `userId` INTEGER NOT NULL;
UPDATE `experience_transaction` SET `userId` = `channelId`;
CREATE INDEX `experience_transaction_userId_fkey` ON `experience_transaction`(`userId`);
ALTER TABLE `experience_transaction` ADD CONSTRAINT `experience_transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `experience_transaction` DROP FOREIGN KEY `experience_transaction_channelId_fkey`;
ALTER TABLE `experience_transaction` DROP COLUMN `channelId`;

-- viewing_block
ALTER TABLE `viewing_block` ADD COLUMN `userId` INTEGER NOT NULL;
UPDATE `viewing_block` SET `userId` = `channelId`;
CREATE INDEX `viewing_block_userId_fkey` ON `viewing_block`(`userId`);
ALTER TABLE `viewing_block` ADD CONSTRAINT `viewing_block_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `viewing_block` DROP FOREIGN KEY `viewing_block_channelId_fkey`;
ALTER TABLE `viewing_block` DROP COLUMN `channelId`;

-- chat_message (make channelId nullable)
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_channelId_fkey`;
ALTER TABLE `chat_message` MODIFY `channelId` INTEGER NULL;
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
