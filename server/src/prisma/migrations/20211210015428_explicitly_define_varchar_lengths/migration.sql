/*
  Warnings:

  - You are about to alter the column `youtubeId` on the `channel` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(63)`.

*/
-- AlterTable
ALTER TABLE `channel` MODIFY `youtubeId` VARCHAR(63) NOT NULL;

-- AlterTable
ALTER TABLE `channel_info` MODIFY `name` VARCHAR(255) NOT NULL,
    MODIFY `imageUrl` VARCHAR(511) NOT NULL;

-- AlterTable
ALTER TABLE `chat_emoji` MODIFY `youtubeId` VARCHAR(255) NOT NULL,
    MODIFY `imageUrl` VARCHAR(511) NULL;

-- AlterTable
ALTER TABLE `chat_message` MODIFY `youtubeId` VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE `livestream` MODIFY `continuationToken` VARCHAR(1023) NULL;
