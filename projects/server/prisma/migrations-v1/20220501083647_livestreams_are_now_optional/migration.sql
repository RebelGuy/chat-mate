/*
  Warnings:

  - You are about to drop the column `livestreamId` on the `experience_transaction` table. All the data in the column will be lost.
  - Added the required column `isActive` to the `livestream` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `livestream` table without a default value. This is not possible if the table is not empty.

*/
-- make livestream of chat_messages optional
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_livestreamId_fkey`;
ALTER TABLE `chat_message` MODIFY `livestreamId` INTEGER NULL;
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `livestream`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- remove livestream from experience_transaction
ALTER TABLE `experience_transaction` DROP FOREIGN KEY `experience_transaction_livestreamId_fkey`;
ALTER TABLE `experience_transaction` DROP COLUMN `livestreamId`;

-- livestream
ALTER TABLE `livestream` ADD COLUMN `isActive` BOOLEAN NOT NULL, -- since null is not allowed, defaults to 0 (false)
    ADD COLUMN `type` ENUM('publicLivestream') NOT NULL; -- this will default to the first enum value
