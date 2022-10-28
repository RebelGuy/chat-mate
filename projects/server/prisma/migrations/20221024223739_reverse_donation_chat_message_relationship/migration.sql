/*
  Warnings:

  - You are about to drop the column `chatMessageId` on the `donation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[donationId]` on the table `chat_message` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `donation` DROP FOREIGN KEY `donation_chatMessage_fkey`;

-- AlterTable
ALTER TABLE `chat_message` ADD COLUMN `donationId` INTEGER NULL;

-- reverse the relationship
UPDATE `chat_message` AS m
  INNER JOIN `donation` AS d ON d.chatMessageId = m.id
  SET `donationId` = d.id;

-- AlterTable
ALTER TABLE `donation` DROP COLUMN `chatMessageId`;

-- CreateIndex
CREATE UNIQUE INDEX `chat_message_donationId_fkey` ON `chat_message`(`donationId`);

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_donationId_fkey` FOREIGN KEY (`donationId`) REFERENCES `donation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
