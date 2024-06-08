/*
  Warnings:

  - Added the required column `sortOrder` to the `custom_emoji` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `custom_emoji` ADD COLUMN `sortOrder` INTEGER NULL;
UPDATE `custom_emoji` SET `sortOrder` = `id` WHERE id > 0;
ALTER TABLE `custom_emoji` MODIFY COLUMN `sortOrder` INTEGER NOT NULL;
