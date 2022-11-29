/*
  Warnings:

  - Added the required column `streamerId` to the `donation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `donation` ADD COLUMN `streamerId` INTEGER NOT NULL DEFAULT 1;

-- remove default
ALTER TABLE `donation` ALTER `streamerId` DROP DEFAULT;


-- CreateTable
CREATE TABLE `streamlabs_socket_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `token` VARCHAR(512) NOT NULL,
    `streamerId` INTEGER NOT NULL,

    UNIQUE INDEX `streamlabs_socket_token_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `donation_streamerId_fkey` ON `donation`(`streamerId`);

-- AddForeignKey
ALTER TABLE `donation` ADD CONSTRAINT `donation_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamlabs_socket_token` ADD CONSTRAINT `streamlabs_socket_token_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
