/*
  Warnings:

  - Added the required column `canUseInDonationMessage` to the `custom_emoji_version` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `custom_emoji_version` ADD COLUMN `canUseInDonationMessage` BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE `custom_emoji_version` ALTER COLUMN `canUseInDonationMessage` DROP DEFAULT;
