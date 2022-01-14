-- CreateTable
CREATE TABLE `LiveViewers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `viewCount` INTEGER NOT NULL,
    `livestreamId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LiveViewers` ADD CONSTRAINT `LiveViewers_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `Livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
