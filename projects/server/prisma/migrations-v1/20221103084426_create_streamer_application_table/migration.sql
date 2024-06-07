-- CreateTable
CREATE TABLE `streamer_application` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timeCreated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `message` VARCHAR(4095) NOT NULL,
    `timeClosed` DATETIME(3) NULL,
    `isApproved` BOOLEAN NULL,
    `closeMessage` VARCHAR(4095) NULL,
    `registeredUserId` INTEGER NOT NULL,

    INDEX `streamer_application_registeredUserId_fkey`(`registeredUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `streamer_application` ADD CONSTRAINT `streamer_application_registeredUserId_fkey` FOREIGN KEY (`registeredUserId`) REFERENCES `registered_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
