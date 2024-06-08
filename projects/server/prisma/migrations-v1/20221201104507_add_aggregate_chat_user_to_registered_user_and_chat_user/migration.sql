/*
  Warnings:

  - You are about to drop the column `chatUserId` on the `registered_user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[aggregateChatUserId]` on the table `registered_user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `aggregateChatUserId` to the `registered_user` table without a default value. This is not possible if the table is not empty.

*/


-- DropForeignKey
ALTER TABLE `registered_user` DROP FOREIGN KEY `registered_user_chatUserId_fkey`;

-- AlterTable
ALTER TABLE `chat_user` ADD COLUMN `aggregateChatUserId` INTEGER NULL,
    ADD COLUMN `linkedAt` DATETIME(3) NULL;

-- AlterTable
-- we don't care about lost link data, because the only link so far was made manually anyway and will be fixed later on
ALTER TABLE `registered_user` DROP COLUMN `chatUserId`,
    ADD COLUMN `aggregateChatUserId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `chat_user` ADD CONSTRAINT `chat_user_aggregateChatUserId_fkey` FOREIGN KEY (`aggregateChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- we will now create a new aggregate chat user for each existing registered user. matching them up is a bit yucky, but it works.
-- our existing connection to a chat user will be reset (the old column was deleted above).
ALTER TABLE `chat_user` ADD COLUMN `temp` INTEGER NULL;

-- create aggreate chat users, match to registered users
INSERT INTO `chat_user` (`temp`)
SELECT id FROM `registered_user`;

-- match registered users with the new aggregate chat users
UPDATE `registered_user` AS r
INNER JOIN `chat_user` AS c ON c.temp = r.id
SET r.aggregateChatUserId = c.id
WHERE r.id > 0; -- this WHERE was required when testing in Workbench

-- clean up
ALTER TABLE `chat_user` DROP COLUMN `temp`;


-- add the keys - this has to be done last
-- CreateIndex
CREATE UNIQUE INDEX `registered_user_aggregateChatUserId_fkey` ON `registered_user`(`aggregateChatUserId`);

-- AddForeignKey
ALTER TABLE `registered_user` ADD CONSTRAINT `registered_user_aggregateChatUserId_fkey` FOREIGN KEY (`aggregateChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
