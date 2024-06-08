/*
  Warnings:

  - You are about to drop the column `adminRegisteredUserId` on the `experience_data_admin` table. All the data in the column will be lost.
  - Added the required column `adminUserId` to the `experience_data_admin` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `experience_data_admin` DROP FOREIGN KEY `experience_data_admin_adminRegisteredUserId_fkey`;

-- AlterTable
ALTER TABLE `experience_data_admin` RENAME COLUMN `adminRegisteredUserId` TO `adminUserId`,
  RENAME INDEX `experience_data_admin_adminRegisteredUserId_fkey` TO `experience_data_admin_adminUserId_fkey`;

-- AddForeignKey
ALTER TABLE `experience_data_admin` ADD CONSTRAINT `experience_data_admin_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
