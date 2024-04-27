/*
  Warnings:

  - You are about to drop the column `imageHeight` on the `chat_emoji` table. All the data in the column will be lost.
  - You are about to drop the column `imageWidth` on the `chat_emoji` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `custom_emoji_version` table. All the data in the column will be lost.
  - Added the required column `imageId` to the `chat_emoji` table without a default value. This is not possible if the table is not empty.
  - Made the column `imageUrl` on table `chat_emoji` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `imageId` to the `custom_emoji_version` table without a default value. This is not possible if the table is not empty.

*/

-- CreateTable
CREATE TABLE `image` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `modifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fingerprint` VARCHAR(191) NOT NULL,
    `originalUrl` VARCHAR(191) NULL,
    `url` VARCHAR(127) NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,

    UNIQUE INDEX `image_fingerprint_key`(`fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add imageId columns
ALTER TABLE `chat_emoji` DROP COLUMN `imageHeight`,
    DROP COLUMN `imageWidth`,
    ADD COLUMN `imageId` INTEGER NULL,
    MODIFY `imageUrl` VARCHAR(511) NOT NULL;
ALTER TABLE `custom_emoji_version` DROP COLUMN `image`,
    ADD COLUMN `imageId` INTEGER NULL;

-- Add empty image records (with the correct fingerprints)
INSERT INTO `image` (`fingerprint`, `originalUrl`, `url`, `width`, `height`)
    SELECT CONCAT('emoji/', `imageUrl`), `imageUrl`, '', 0, 0 FROM `chat_emoji`;
INSERT INTO `image` (`fingerprint`, `url`, `width`, `height`)
    SELECT CONCAT('custom-emoji/', `e`.`streamerId`, '/', `e`.`id`, '/', `v`.`version`), '', 0, 0 FROM `custom_emoji_version` `v`
        LEFT JOIN `custom_emoji` `e` ON `v`.`customEmojiId` = `e`.`id`;

-- Link up the image records
UPDATE `chat_emoji` `e`
    INNER JOIN `image` `i` ON `i`.`fingerprint` = CONCAT('emoji/', `e`.`imageUrl`)
    SET `e`.`imageId` = `i`.`id`
    WHERE `e`.`id` > 0;
UPDATE `custom_emoji_version` `v`
    INNER JOIN `custom_emoji` `e` ON `v`.`customEmojiId` = `e`.`id`
    INNER JOIN `image` `i` ON `i`.`fingerprint` = CONCAT('custom-emoji/', `e`.`streamerId`, '/', `e`.`id`, '/', `v`.`version`)
    SET `v`.`imageId` = `i`.`id`
    WHERE `v`.`id` > 0;

-- Clean up
ALTER TABLE `chat_emoji` MODIFY `imageId` INTEGER NOT NULL;
ALTER TABLE `custom_emoji_version` MODIFY `imageId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `chat_emoji_imageId_key` ON `chat_emoji`(`imageId`);

-- CreateIndex
CREATE INDEX `custom_emoji_imageId_key` ON `custom_emoji_version`(`imageId`);

-- AddForeignKey
ALTER TABLE `chat_emoji` ADD CONSTRAINT `chat_emoji_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `image`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_emoji_version` ADD CONSTRAINT `custom_emoji_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `image`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
