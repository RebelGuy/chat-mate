/*
  Warnings:

  - A unique constraint covering the columns `[streamerId,symbol]` on the table `custom_emoji` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `streamerId` to the `custom_emoji` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `custom_emoji_symbol_key` ON `custom_emoji`;

-- AlterTable
ALTER TABLE `custom_emoji` ADD COLUMN `streamerId` INTEGER NOT NULL DEFAULT 1;

-- remove default
ALTER TABLE `custom_emoji` ALTER `streamerId` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `custom_emoji_streamerId_key` ON `custom_emoji`(`streamerId`);

-- CreateIndex
CREATE UNIQUE INDEX `custom_emoji_streamerId_symbol_key` ON `custom_emoji`(`streamerId`, `symbol`);

-- AddForeignKey
ALTER TABLE `custom_emoji` ADD CONSTRAINT `custom_emoji_streamerId_key` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
