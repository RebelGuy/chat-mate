-- CreateTable
CREATE TABLE `twitch_auth` (
    `clientId` VARCHAR(191) NOT NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `refreshToken` VARCHAR(191) NOT NULL,
    `expiresIn` INTEGER NOT NULL,
    `obtainmentTimestamp` INTEGER NOT NULL,
    `scope` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`clientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
