/*
  Warnings:

  - A unique constraint covering the columns `[linkIdentifier,streamerId]` on the table `donation_link` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `streamerId` to the `donation_link` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `donation_link_linkIdentifier_key` ON `donation_link`;

-- DropIndex
DROP INDEX `donation_link_linkIdentifier_linkedUserId_key` ON `donation_link`;

-- AlterTable (temporary default value to ensure we end up in a valid state)
ALTER TABLE `donation_link` ADD COLUMN `streamerId` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `donation_link` ALTER COLUMN `streamerId` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `donation_link_streamerId_fkey` ON `donation_link`(`streamerId`);

-- CreateIndex
CREATE UNIQUE INDEX `donation_link_linkIdentifier_streamerId_key` ON `donation_link`(`linkIdentifier`, `streamerId`);

-- AddForeignKey
ALTER TABLE `donation_link` ADD CONSTRAINT `donation_link_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
