-- CreateTable
CREATE TABLE `masterchat_action` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timeAdded` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `type` VARCHAR(64) NOT NULL,
    `data` VARCHAR(1024) NOT NULL,
    `time` DATETIME(3) NULL,
    `livestreamId` INTEGER NOT NULL,

    INDEX `masterchat_action_livestreamId_fkey`(`livestreamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `masterchat_action` ADD CONSTRAINT `masterchat_action_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
