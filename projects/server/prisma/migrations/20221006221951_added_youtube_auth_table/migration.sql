-- CreateTable
CREATE TABLE `youtube_auth` (
    `channelId` VARCHAR(191) NOT NULL,
    `accessToken` VARCHAR(511) NOT NULL,
    `updateTime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`channelId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
