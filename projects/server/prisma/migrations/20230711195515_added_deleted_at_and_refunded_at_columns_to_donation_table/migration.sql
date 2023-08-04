/*
  Warnings:

  - You are about to drop the column `isRefunded` on the `donation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `donation` DROP COLUMN `isRefunded`,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `refundedAt` DATETIME(3) NULL;
