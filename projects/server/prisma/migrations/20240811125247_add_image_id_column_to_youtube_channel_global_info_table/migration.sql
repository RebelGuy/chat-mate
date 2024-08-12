/*
  Warnings:

  - Added the required column `imageId` to the `youtube_channel_global_info` table without a default value. This is not possible if the table is not empty.

*/
-- Add the imageId column (must be nullable since we don't know the values yet)
ALTER TABLE `youtube_channel_global_info` ADD COLUMN `imageId` INTEGER NULL;

-- Add empty image records (with the correct fingerprints)
INSERT INTO `image` (`fingerprint`, `originalUrl`, `url`, `width`, `height`)
    SELECT CONCAT('channel/youtube/', `imageUrl`), `imageUrl`, '', 0, 0 FROM `youtube_channel_global_info`
    ON DUPLICATE KEY UPDATE `fingerprint`=`fingerprint`; -- do nothing if there is a duplicate fingerprint

-- Link up the image records
UPDATE `youtube_channel_global_info` `y`
    INNER JOIN `image` `i` ON `i`.`fingerprint` = CONCAT('channel/youtube/', `y`.`imageUrl`)
    SET `y`.`imageId` = `i`.`id`
    WHERE `y`.`id` > 0;

-- make the imageId column non-nullable
ALTER TABLE `youtube_channel_global_info` MODIFY `imageId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `youtube_channel_global_info_imageId_fkey` ON `youtube_channel_global_info`(`imageId`);

-- AddForeignKey
ALTER TABLE `youtube_channel_global_info` ADD CONSTRAINT `youtube_channel_global_info_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `image`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

