/*
  Warnings:

  - You are about to drop the column `externalId` on the `chat_emoji` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[imageUrl]` on the table `chat_emoji` will be added. If there are existing duplicate values, this will fail.

*/

-- DropIndex
DROP INDEX `chat_emoji_externalId_key` ON `chat_emoji`;

-- AlterTable
ALTER TABLE `chat_emoji` DROP COLUMN `externalId`;

-- we need to rewire all chat_message_part.emojiId values to use only the first occurrence of an emoji (where multiple occurrences are characterised by having the same imageUrls).
-- this way, we will be able to safely deleted duplicates, and finally add a unique index to the imageUrl column
ALTER TABLE chat_emoji
ADD COLUMN newId INT NULL;

-- this sets the value of the new column to the custom_emoji id that parts should reference instead of the current one
UPDATE chat_emoji AS x1
LEFT JOIN chat_emoji AS x2 ON x1.imageUrl = x2.imageUrl
SET x1.newId = x2.id
WHERE x1.id > 0 AND x1.id > x2.id; -- only go backwards (otherwise we would have duplicates)

-- every part needs to be updated to reference either the newId if it exists, or keep the existing id
UPDATE chat_message_part AS part
LEFT JOIN chat_emoji AS emoji ON part.emojiId = emoji.id
SET part.emojiId = COALESCE(emoji.newId, emoji.id)
WHERE part.emojiId IS NOT NULL;

ALTER TABLE chat_emoji
DROP COLUMN newId;

-- delete all emojis that are not referenced by a chat_message_part.
-- wrap the sub-query to avoid "derived merge optimization", which would cause the non-wrapped version of the query to fail:
-- https://stackoverflow.com/a/9843719
-- also we must disable safe mode (restricts us from modifying entries without a WHERE clause that uses a KEY column, which I thought we are doing but apparently not):
-- https://stackoverflow.com/a/57683093
SET SQL_SAFE_UPDATES = 0;
DELETE FROM chat_emoji AS emoji
WHERE emoji.id IN (
	SELECT id FROM (
		SELECT emoji.id AS id FROM chat_emoji AS emoji
		LEFT JOIN chat_message_part as part ON part.emojiId = emoji.id
		WHERE part.id IS NULL
	) AS x
    WHERE id > 0
);
SET SQL_SAFE_UPDATES = 1;
-- at this point, all remaining urls should be unique

-- CreateIndex
CREATE UNIQUE INDEX `chat_emoji_imageUrl_key` ON `chat_emoji`(`imageUrl`);
