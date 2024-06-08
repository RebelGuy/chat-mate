-- CreateTable
CREATE TABLE `youtube_api_request` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `request` VARCHAR(128) NOT NULL,
    `cost` INTEGER NOT NULL,
    `success` BOOLEAN NOT NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `youtube_api_request_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `youtube_api_request` ADD CONSTRAINT `youtube_api_request_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
