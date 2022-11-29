/*
  Warnings:

  - Added the required column `streamerId` to the `livestream` table without a default value. This is not possible if the table is not empty.

*/

-- the streamerId is required, so we create a new streamer (there are no entries yet, it will have an id of 1)
-- and add it to the existing livestreams. later on we will have to manually link that streamer to the youtube
-- and twitch channels, as technically it is an invalid streamer right now.
INSERT INTO `registered_user` (`username`, `hashedPassword`)
  VALUES ('rebel_guy', '8488eda85ee4f157b840727fe6cfb9e6186fb552e4d53326227e866fd6c8ed53');

INSERT INTO `streamer` (`registeredUserId`)
  SELECT id FROM `registered_user` WHERE `username` = 'rebel_guy';

-- AlterTable
ALTER TABLE `livestream` ADD COLUMN `streamerId` INTEGER NOT NULL DEFAULT 1;

-- remove default
ALTER TABLE `livestream` ALTER `streamerId` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `livestream_streamerId_fkey` ON `livestream`(`streamerId`);

-- AddForeignKey
ALTER TABLE `livestream` ADD CONSTRAINT `livestream_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
