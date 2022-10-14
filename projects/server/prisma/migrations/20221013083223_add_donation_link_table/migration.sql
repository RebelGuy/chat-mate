/*
  Warnings:

  - You are about to drop the column `linkedAt` on the `donation` table. All the data in the column will be lost.
  - You are about to drop the column `linkedUserId` on the `donation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `donation` DROP FOREIGN KEY `donation_linkedUserId_fkey`;

-- can't automatically move links to new table because we didn't yet save the streamlabsUserId (but I have them, so will insert manually once migration is done)
-- AlterTable
ALTER TABLE `donation` DROP COLUMN `linkedAt`,
    DROP COLUMN `linkedUserId`,
    ADD COLUMN `streamlabsUserId` INTEGER NULL;

-- CreateTable
CREATE TABLE `donation_link` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `linkIdentifier` VARCHAR(191) NOT NULL,
    `linkedAt` DATETIME(3) NOT NULL,
    `linkedUserId` INTEGER NOT NULL,

    UNIQUE INDEX `donation_link_linkIdentifier_key`(`linkIdentifier`),
    UNIQUE INDEX `donation_link_linkIdentifier_linkedUserId_key`(`linkIdentifier`, `linkedUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `donation_link` ADD CONSTRAINT `donation_link_linkedUserId_fkey` FOREIGN KEY (`linkedUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
