/*
  Warnings:

  - You are about to drop the column `image` on the `custom_emoji_version` table. All the data in the column will be lost.
  - Added the required column `imageUrl` to the `custom_emoji_version` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `custom_emoji_version` DROP COLUMN `image`,
    ADD COLUMN `imageUrl` VARCHAR(63) NULL;
UPDATE `custom_emoji_version` SET `imageUrl` = '' WHERE id > 0;
ALTER TABLE `custom_emoji_version` MODIFY COLUMN `imageUrl` VARCHAR(63) NOT NULL;
