-- CreateTable
CREATE TABLE `donation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `streamlabsId` INTEGER NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `name` VARCHAR(256) NOT NULL,
    `message` VARCHAR(256) NULL,
    `linkedUserId` INTEGER NULL,

    INDEX `donation_linkedUserId_fkey`(`linkedUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `donation` ADD CONSTRAINT `donation_linkedUserId_fkey` FOREIGN KEY (`linkedUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
