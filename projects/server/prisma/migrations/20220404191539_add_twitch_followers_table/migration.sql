-- CreateTable
CREATE TABLE `twitch_followers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `twitchId` VARCHAR(32) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userName` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `twitch_followers_twitchId_key`(`twitchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
