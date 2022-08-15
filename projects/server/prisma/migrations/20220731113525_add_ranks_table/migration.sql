-- CreateTable
CREATE TABLE `rank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` ENUM('owner', 'famous', 'mod') NOT NULL,
    `displayName` VARCHAR(64) NOT NULL,
    `description` VARCHAR(1024) NULL,
    `group` ENUM('cosmetic', 'administration', 'punishment', 'donation') NOT NULL,

    UNIQUE INDEX `rank_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_rank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issuedAt` DATETIME(3) NOT NULL,
    `expirationTime` DATETIME(3) NULL,
    `message` VARCHAR(1024) NULL,
    `revokedTime` DATETIME(3) NULL,
    `revokeMessage` VARCHAR(1024) NULL,
    `rankId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `assignedByUserId` INTEGER NULL,
    `revokedByUserId` INTEGER NULL,

    INDEX `user_rank_rankId_fkey`(`rankId`),
    INDEX `user_rank_userId_fkey`(`userId`),
    INDEX `user_rank_expirationTime_key`(`expirationTime`),
    INDEX `user_rank_revokedTime_key`(`revokedTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_assignedByUserId_fkey` FOREIGN KEY (`assignedByUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_revokedByUserId_fkey` FOREIGN KEY (`revokedByUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
