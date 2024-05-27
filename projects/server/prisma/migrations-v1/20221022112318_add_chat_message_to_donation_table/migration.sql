/*
  Warnings:

  - You are about to drop the column `message` on the `donation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[chatMessageId]` on the table `donation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `chatMessageId` to the `donation` table without a default value. This is not possible if the table is not empty.

*/

-- make `chat_message.userId` optional
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_userId_fkey`;
ALTER TABLE `chat_message` MODIFY `userId` INTEGER NULL;
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- add new column
ALTER TABLE `donation` ADD COLUMN `chatMessageId` INTEGER NULL; -- nullable since there might not be a message

-- temporary columns
ALTER TABLE `chat_text` ADD COLUMN `donationId` INTEGER NULL;
ALTER TABLE `chat_message` ADD COLUMN `donationId` INTEGER NULL;

-- create the required entries in `chat_text`, `chat_message` and `chat_message_part`, and link them together
INSERT INTO `chat_text` (`text`, `donationId`, `isBold`, `isItalics`)
  SELECT `message`, `id`, 0, 0
  FROM `donation`
  WHERE `message` IS NOT NULL;
INSERT INTO `chat_message` (`externalId`, `time`, `youtubeChannelId`, `livestreamId`, `twitchChannelId`, `userId`, `contextToken`, `donationId`)
  SELECT `streamlabsId`, `time`, NULL, NULL, NULL, NULL, NULL, `id`
  FROM `donation`
  WHERE `message` IS NOT NULL;
INSERT INTO `chat_message_part` (`order`, `chatMessageId`, `textId`, `emojiId`, `customEmojiId`, `cheerId`)
  SELECT 0, m.id, t.id, NULL, NULL, NULL
  FROM `donation` AS d
  INNER JOIN `chat_message` AS m ON d.id = m.donationId
  INNER JOIN `chat_text` AS t ON d.id = t.donationId
  WHERE d.message IS NOT NULL;
UPDATE `donation` AS d
  INNER JOIN `chat_message` AS m ON d.id = m.donationId
  SET `chatMessageId` = m.id;

-- remove temporary columns
ALTER TABLE `chat_text` DROP COLUMN `donationId`;
ALTER TABLE `chat_message` DROP COLUMN `donationId`;

-- the message data now exists within `chat_message` -> `chat_message_part` -> `chat_text`
ALTER TABLE `donation` DROP COLUMN `message`;

-- CreateIndex
CREATE UNIQUE INDEX `donation_chatMessage_fkey` ON `donation`(`chatMessageId`);
ALTER TABLE `donation` ADD CONSTRAINT `donation_chatMessage_fkey` FOREIGN KEY (`chatMessageId`) REFERENCES `chat_message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
