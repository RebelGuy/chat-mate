/*
  Warnings:

  - You are about to drop the column `isActive` on the `custom_emoji_version` table. All the data in the column will be lost.

*/

DROP TRIGGER IF EXISTS `TRG_CHECK_EXISTING_ACTIVE_VERSION`;

-- AlterTable
ALTER TABLE `custom_emoji` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- in production, we only have one emoji deleted, so it's not worth writing a migration to transfer this to the `deletedAt` column
-- AlterTable
ALTER TABLE `custom_emoji_version` DROP COLUMN `isActive`;
