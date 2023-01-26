-- CreateTable
CREATE TABLE `chat_command` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `normalisedCommandName` VARCHAR(64) NOT NULL,
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `result` VARCHAR(1024) NULL,
    `error` VARCHAR(1024) NULL,
    `chatMessageId` INTEGER NOT NULL,

    UNIQUE INDEX `chat_command_chatMessageId_fkey`(`chatMessageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chat_command` ADD CONSTRAINT `chat_command_chatMessageId_fkey` FOREIGN KEY (`chatMessageId`) REFERENCES `chat_message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
