/*
  Warnings:

  - You are about to drop the column `customEmojiId` on the `custom_emoji_rank_whitelist` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[customEmojiVersionId,rankId]` on the table `custom_emoji_rank_whitelist` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `customEmojiVersionId` to the `custom_emoji_rank_whitelist` table without a default value. This is not possible if the table is not empty.

*/

ALTER TABLE `custom_emoji_rank_whitelist` ADD COLUMN `customEmojiVersionId` INTEGER NOT NULL;

-- transfer all old emoji whitelists to the newest version.
-- note: we use a LEFT JOIN instead of using a sub-query when setting the value directly, as that sub-query can't contain the very table we are updating.
UPDATE custom_emoji_rank_whitelist AS whitelist
LEFT JOIN (
	SELECT whitelist.id AS whitelistId, emojiVersion.id as emojiVersionId FROM custom_emoji_rank_whitelist whitelist
	JOIN (
		SELECT customEmojiId, MAX(version) AS version
		FROM custom_emoji_version
		GROUP BY customEmojiId
	) latestVersion ON latestVersion.customEmojiId = whitelist.customEmojiId
	JOIN custom_emoji_version emojiVersion ON emojiVersion.customEmojiId = latestVersion.customEmojiId AND emojiVersion.version = latestVersion.version
) AS derived ON derived.whitelistId = whitelist.id
SET customEmojiVersionId = derived.emojiVersionId
WHERE whitelist.id > 0;

-- delete the old column
ALTER TABLE `custom_emoji_rank_whitelist` DROP FOREIGN KEY `custom_emoji_rank_whitelist_customEmojiId_fkey`;
DROP INDEX `custom_emoji_rank_whitelist_customEmojiId_rankId_key` ON `custom_emoji_rank_whitelist`;
ALTER TABLE `custom_emoji_rank_whitelist` DROP COLUMN `customEmojiId`;

-- add constraints to the new column
CREATE UNIQUE INDEX `custom_emoji_rank_whitelist_customEmojiVersionId_rankId_key` ON `custom_emoji_rank_whitelist`(`customEmojiVersionId`, `rankId`);
ALTER TABLE `custom_emoji_rank_whitelist` ADD CONSTRAINT `custom_emoji_rank_whitelist_customEmojiVersionId_fkey` FOREIGN KEY (`customEmojiVersionId`) REFERENCES `custom_emoji_version`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
