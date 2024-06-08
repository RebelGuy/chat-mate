/*
  Warnings:

  - You are about to drop the column `livestreamId` on the `chat_message` table. All the data in the column will be lost.
  - You are about to drop the column `livestreamId` on the `masterchat_action` table. All the data in the column will be lost.
  - You are about to drop the `live_viewer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `livestream` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `youtubeLivestreamId` to the `masterchat_action` table without a default value. This is not possible if the table is not empty.
*/

/* chat_message (1/2) */
ALTER TABLE `chat_message`
    ADD COLUMN `youtubeLivestreamId` INTEGER NULL,
    ADD COLUMN `twitchLivestreamId` INTEGER NULL;

-- update the data. we have created a TwitchLivestream for every YoutubeLivestream, so the ids will match valid rows once we set foreign key constraints below
UPDATE `chat_message` SET `youtubeLivestreamId` = `livestreamId`
WHERE `livestreamId` IS NOT NULL AND `youtubeChannelId` IS NOT NULL;
UPDATE `chat_message` SET `twitchLivestreamId` = `livestreamId`
WHERE `livestreamId` IS NOT NULL AND `twitchChannelId` IS NOT NULL;

CREATE INDEX `chat_message_youtubeLivestreamId_fkey` ON `chat_message`(`youtubeLivestreamId`);
CREATE INDEX `chat_message_twitchLivestreamId_fkey` ON `chat_message`(`twitchLivestreamId`);

-- drop livestreamId column - all data has been transferred to the new columns
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_livestreamId_fkey`;
ALTER TABLE `chat_message` DROP COLUMN `livestreamId`;


/* live_viewer (1/2) */
CREATE TABLE `youtube_live_viewer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `viewCount` INTEGER NOT NULL,
    `youtubeLivestreamId` INTEGER NOT NULL,

    INDEX `youtube_live_viewer_youtubeLivestreamId_fkey`(`youtubeLivestreamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `twitch_live_viewer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `viewCount` INTEGER NOT NULL,
    `twitchLivestreamId` INTEGER NOT NULL,

    INDEX `twitch_live_viewer_twitchLivestreamId_fkey`(`twitchLivestreamId`),
    INDEX `live_viewer_time_key`(`time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- populating the new tables is easy, since we already stored youtube and twitch viewers - we just need to split that data.
-- again, there is a one-to-one mapping between the previous livestreamId and youtubeLivestreamId/twitchLivestreamId
INSERT INTO `youtube_live_viewer` (`time`, `viewCount`, `youtubeLivestreamId`)
SELECT `time`, `youtubeViewCount`, `livestreamId` FROM `live_viewer`;

INSERT INTO `twitch_live_viewer` (`time`, `viewCount`, `twitchLivestreamId`)
SELECT `time`, `twitchViewCount`, `livestreamId` FROM `live_viewer`;

-- no need to keep this old data around
ALTER TABLE `live_viewer` DROP FOREIGN KEY `live_viewer_livestreamId_fkey`;
DROP TABLE `live_viewer`;


/* livestream (1/1) */
-- assume we were live on twitch every time we were live on youtube (this is not technically true,
-- but simplifies this migration considerably as it means we can map the old livestream one-to-one to youtube and twitch livestreams)
CREATE TABLE `youtube_livestream` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `liveId` VARCHAR(11) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `start` DATETIME(3) NULL,
    `end` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL,
    `continuationToken` VARCHAR(1023) NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `youtube_livestream_streamerId_fkey`(`streamerId`),
    UNIQUE INDEX `youtube_livestream_liveId_key`(`liveId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `twitch_livestream` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `twitch_livestream_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `youtube_livestream` (`id`, `liveId`, `createdAt`, `start`, `end`, `isActive`, `continuationToken`, `streamerId`)
SELECT `id`, `liveId`, `createdAt`, `start`, `end`, `isActive`, `continuationToken`, `streamerId` FROM `livestream`;

-- because we want a one-to-one mapping, but run into the danger of creating invalid twitch data for youtube livestreams that have never started,
-- we cheat a little and create 1-second long twitch streams in those cases
INSERT INTO `twitch_livestream` (`id`, `start`, `end`, `streamerId`)
SELECT `id`, COALESCE(`start`, `createdAt`), (CASE `start` WHEN NULL THEN DATE_ADD(`createdAt`, INTERVAL 1 SECOND) ELSE `end` END), `streamerId` FROM `livestream`;

-- at this point, there might be some twitch entries with a null end time - just add one second to the start time.
-- note that it is a known limitation that in-progress livestreams will not work correctly, but we can just not be live while we do the deployment...
UPDATE `twitch_livestream` SET `end` = DATE_ADD(`start`, INTERVAL 1 SECOND)
WHERE `end` IS NULL AND id > 0; -- id condition to make mysql happy

-- add foreign keys
ALTER TABLE `youtube_livestream` ADD CONSTRAINT `youtube_livestream_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `twitch_livestream` ADD CONSTRAINT `twitch_livestream_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


/* chat_message (2/2) */
-- adding foreign keys to the new chat_message columns
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_youtubeLivestreamId_fkey` FOREIGN KEY (`youtubeLivestreamId`) REFERENCES `youtube_livestream`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_twitchLivestreamId_fkey` FOREIGN KEY (`twitchLivestreamId`) REFERENCES `twitch_livestream`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


/* live_viewer (2/2) */
ALTER TABLE `youtube_live_viewer` ADD CONSTRAINT `youtube_live_viewer_youtubeLivestreamId_fkey` FOREIGN KEY (`youtubeLivestreamId`) REFERENCES `youtube_livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `twitch_live_viewer` ADD CONSTRAINT `twitch_live_viewer_twitchLivestreamId_fkey` FOREIGN KEY (`twitchLivestreamId`) REFERENCES `twitch_livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


/* masterchat_action */
-- Replace the old livestreamId with youtubeLivestreamId. The values remain the same since there is a one-to-one mapping between Livestream and YoutubeLivestream during this migration
ALTER TABLE `masterchat_action` DROP FOREIGN KEY `masterchat_action_livestreamId_fkey`;
ALTER TABLE `masterchat_action` RENAME COLUMN `livestreamId` TO `youtubeLivestreamId`;
ALTER TABLE `masterchat_action` RENAME INDEX `masterchat_action_livestreamId_fkey` TO `masterchat_action_youtubeLivestreamId_fkey`;
ALTER TABLE `masterchat_action` ADD CONSTRAINT `masterchat_action_youtubeLivestreamId_fkey` FOREIGN KEY (`youtubeLivestreamId`) REFERENCES `youtube_livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


/* livestream (2/2) */
-- delete old data
ALTER TABLE `livestream` DROP FOREIGN KEY `livestream_streamerId_fkey`;
DROP TABLE `livestream`;
