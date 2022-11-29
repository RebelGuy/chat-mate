/*
  Warnings:

  - You are about to drop the column `adminUserId` on the `experience_data_admin` table. All the data in the column will be lost.
  - You are about to drop the column `assignedByUserId` on the `user_rank` table. All the data in the column will be lost.
  - You are about to drop the column `revokedByUserId` on the `user_rank` table. All the data in the column will be lost.
  - Added the required column `adminRegisteredUserId` to the `experience_data_admin` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `experience_data_admin` DROP FOREIGN KEY `experience_data_admin_adminUserId_fkey`;

-- DropForeignKey
ALTER TABLE `user_rank` DROP FOREIGN KEY `user_rank_assignedByUserId_fkey`;

-- DropForeignKey
ALTER TABLE `user_rank` DROP FOREIGN KEY `user_rank_revokedByUserId_fkey`;

-- AlterTable
-- all entries perviously assigned by userId 56 are now assigned by registered user 1 (there was an earlier migration that ensured this registered user exists)
ALTER TABLE `experience_data_admin` ADD COLUMN `adminRegisteredUserId` INTEGER NOT NULL;
UPDATE `experience_data_admin` SET `adminRegisteredUserId` = 1 WHERE `adminUserId` = 56;
ALTER TABLE `experience_data_admin` DROP COLUMN `adminUserId`;

-- AlterTable
ALTER TABLE `user_rank`DROP COLUMN `revokedByUserId`,
    ADD COLUMN `assignedByRegisteredUserId` INTEGER NULL,
    ADD COLUMN `revokedByRegisteredUserId` INTEGER NULL;
UPDATE `user_rank` SET `assignedByRegisteredUserId` = 1 WHERE `assignedByUserId` = 56;
ALTER TABLE `user_rank`DROP COLUMN `assignedByUserId`;

-- CreateIndex
CREATE INDEX `experience_data_admin_adminRegisteredUserId_fkey` ON `experience_data_admin`(`adminRegisteredUserId`);

-- AddForeignKey
ALTER TABLE `experience_data_admin` ADD CONSTRAINT `experience_data_admin_adminRegisteredUserId_fkey` FOREIGN KEY (`adminRegisteredUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_assignedByRegisteredUserId_fkey` FOREIGN KEY (`assignedByRegisteredUserId`) REFERENCES `registered_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_revokedByRegisteredUserId_fkey` FOREIGN KEY (`revokedByRegisteredUserId`) REFERENCES `registered_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
