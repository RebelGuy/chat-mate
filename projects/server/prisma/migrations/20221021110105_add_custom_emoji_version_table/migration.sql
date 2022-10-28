/*
  Warnings:

  - You are about to drop the column `customEmojiId` on the `chat_custom_emoji` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `custom_emoji` table. All the data in the column will be lost.
  - You are about to drop the column `levelRequirement` on the `custom_emoji` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `custom_emoji` table. All the data in the column will be lost.
  - Added the required column `customEmojiVersionId` to the `chat_custom_emoji` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `chat_custom_emoji` DROP FOREIGN KEY `chat_custom_emoji_customEmojiId_fkey`;

-- CreateTable
CREATE TABLE `custom_emoji_version` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isActive` BOOLEAN NOT NULL DEFAULT 1,
    `modifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `version` INTEGER NOT NULL DEFAULT 0,
    `name` VARCHAR(63) NOT NULL,
    `image` BLOB NOT NULL,
    `levelRequirement` SMALLINT UNSIGNED NOT NULL,
    `customEmojiId` INTEGER NOT NULL,

    UNIQUE INDEX `custom_emoji_version_customEmojiId_version_key`(`customEmojiId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- copy data
INSERT INTO `custom_emoji_version` (`name`, `image`, `levelRequirement`, `customEmojiId`)
SELECT `name`, `image`, `levelRequirement`, `id`
FROM `custom_emoji`;

-- remove defaults
ALTER TABLE `custom_emoji_version` ALTER COLUMN `isActive` DROP DEFAULT;
ALTER TABLE `custom_emoji_version` ALTER COLUMN `version` DROP DEFAULT;

-- rename column and index
ALTER TABLE `chat_custom_emoji` RENAME COLUMN `customEmojiId` TO `customEmojiVersionId`,
	RENAME INDEX `chat_custom_emoji_customEmojiId_fkey` TO `chat_custom_emoji_customEmojiVersionId_fkey`;

-- AlterTable
ALTER TABLE `custom_emoji` DROP COLUMN `image`,
    DROP COLUMN `levelRequirement`,
    DROP COLUMN `name`;

-- AddForeignKey
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_customEmojiVersionId_fkey` FOREIGN KEY (`customEmojiVersionId`) REFERENCES `custom_emoji_version`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_emoji_version` ADD CONSTRAINT `custom_emoji_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `custom_emoji`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
