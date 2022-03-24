/*
  Warnings:

  - You are about to drop the column `youtubeId` on the `chat_emojis` table. All the data in the column will be lost.
  - You are about to drop the column `youtubeId` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `viewCount` on the `live_viewers` table. All the data in the column will be lost.
  - You are about to drop the column `IsVerified` on the `youtube_channel_info` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[externalId]` on the table `chat_emojis` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `chat_messages` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `externalId` to the `chat_emojis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalId` to the `chat_messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `youtubeViewCount` to the `live_viewers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isVerified` to the `youtube_channel_info` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `chat_emojis_youtubeId_key` ON `chat_emojis`;

-- DropIndex
DROP INDEX `chat_messages_youtubeId_key` ON `chat_messages`;

-- AlterTable
ALTER TABLE `chat_emojis` RENAME COLUMN `youtubeId` TO `externalId`;

-- AlterTable
ALTER TABLE `chat_messages` RENAME COLUMN `youtubeId` TO `externalId`;

-- AlterTable
ALTER TABLE `live_viewers` RENAME COLUMN `viewCount` TO `youtubeViewCount`;

-- AlterTable
ALTER TABLE `youtube_channel_info` RENAME COLUMN `IsVerified` TO `isVerified`;

-- CreateIndex
CREATE UNIQUE INDEX `chat_emojis_externalId_key` ON `chat_emojis`(`externalId`);

-- CreateIndex
CREATE UNIQUE INDEX `chat_messages_externalId_key` ON `chat_messages`(`externalId`);
