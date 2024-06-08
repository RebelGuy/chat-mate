/*
  Warnings:

  - Added the required column `streamerId` to the `chat_message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `chat_message` ADD COLUMN `streamerId` INTEGER NOT NULL DEFAULT 1;

-- remove default
ALTER TABLE `chat_message` ALTER `streamerId` DROP DEFAULT;


-- CreateIndex
CREATE INDEX `chat_message_streamerId_fkey` ON `chat_message`(`streamerId`);

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
