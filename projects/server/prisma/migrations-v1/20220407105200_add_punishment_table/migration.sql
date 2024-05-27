-- CreateTable
CREATE TABLE `punishments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `punishmentType` ENUM('ban', 'timeout') NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL,
    `expirationTime` DATETIME(3) NULL,
    `message` VARCHAR(1024) NULL,
    `revokedTime` DATETIME(3) NULL,
    `revokeMessage` VARCHAR(1024) NULL,
    `userId` INTEGER NOT NULL,
    `adminUserId` INTEGER NOT NULL,

    INDEX `punishments_userId_fkey`(`userId`),
    INDEX `punishments_adminUserId_fkey`(`adminUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `punishments` ADD CONSTRAINT `punishments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `punishments` ADD CONSTRAINT `punishments_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
