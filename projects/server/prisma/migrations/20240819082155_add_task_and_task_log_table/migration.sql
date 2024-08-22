-- CreateTable
CREATE TABLE `task` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskType` ENUM('cleanUpYoutubeContextTokensTask') NOT NULL,
    `intervalMs` INTEGER NOT NULL,

    UNIQUE INDEX `task_taskType_key`(`taskType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `log` VARCHAR(4096) NULL,
    `errorMessage` VARCHAR(4096) NULL,
    `taskId` INTEGER NOT NULL,

    INDEX `task_log_taskId_fkey`(`taskId`),
    INDEX `task_log_startTime_key`(`startTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `task_log` ADD CONSTRAINT `task_log_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `task`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- add the first task
INSERT INTO `task` (`taskType`, `intervalMs`) VALUES ('cleanUpYoutubeContextTokensTask', 86400000);
