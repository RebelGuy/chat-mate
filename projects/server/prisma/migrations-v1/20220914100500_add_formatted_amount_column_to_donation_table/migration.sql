/*
  Warnings:

  - Added the required column `formattedAmount` to the `donation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `donation` ADD COLUMN `formattedAmount` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `donation` ALTER COLUMN `formattedAmount` DROP DEFAULT;