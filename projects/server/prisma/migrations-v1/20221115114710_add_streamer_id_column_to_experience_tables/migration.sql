/*
  Warnings:

  - Added the required column `streamerId` to the `experience_snapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streamerId` to the `experience_transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `experience_snapshot` ADD COLUMN `streamerId` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `experience_transaction` ADD COLUMN `streamerId` INTEGER NOT NULL DEFAULT 1;

-- remove defaults
ALTER TABLE `experience_snapshot` ALTER `streamerId` DROP DEFAULT;
ALTER TABLE `experience_transaction` ALTER `streamerId` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `experience_snapshot_streamerId_fkey` ON `experience_snapshot`(`streamerId`);

-- CreateIndex
CREATE INDEX `experience_transaction_streamerId_fkey` ON `experience_transaction`(`streamerId`);

-- AddForeignKey
ALTER TABLE `experience_transaction` ADD CONSTRAINT `experience_transaction_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_snapshot` ADD CONSTRAINT `experience_snapshot_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
