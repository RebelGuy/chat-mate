/*
  Warnings:

  - You are about to drop the column `assignedByRegisteredUserId` on the `user_rank` table. All the data in the column will be lost.
  - You are about to drop the column `revokedByRegisteredUserId` on the `user_rank` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `user_rank` DROP FOREIGN KEY `user_rank_assignedByRegisteredUserId_fkey`;

-- DropForeignKey
ALTER TABLE `user_rank` DROP FOREIGN KEY `user_rank_revokedByRegisteredUserId_fkey`;

-- AlterTable
ALTER TABLE `user_rank`
    RENAME COLUMN `assignedByRegisteredUserId` TO `assignedByUserId`,
    RENAME COLUMN `revokedByRegisteredUserId` TO `revokedByUserId`,
    RENAME INDEX `user_rank_assignedByRegisteredUserId_fkey` TO `user_rank_assignedByUserId_fkey`,
    RENAME INDEX `user_rank_revokedByRegisteredUserId_fkey` TO `user_rank_revokedBydUserId_fkey`;

-- undoing the hardcoded user from `20221119040821_connect_registered_user_to_admin_columns_instead_of_chat_user`
UPDATE `user_rank` SET `assignedByUserId` = 56 WHERE `assignedByUserId` = 1;
UPDATE `user_rank` SET `revokedByUserId` = 56 WHERE `revokedByUserId` = 1;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_assignedByUserId_fkey` FOREIGN KEY (`assignedByUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_revokedByUserId_fkey` FOREIGN KEY (`revokedByUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
