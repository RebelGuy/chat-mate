-- AlterTable
ALTER TABLE `experience_transaction` ADD COLUMN `originalUserId` INTEGER NULL;

-- CreateTable
CREATE TABLE `link_attempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `errorMessage` VARCHAR(4096) NULL,
    `defaultChatUserId` INTEGER NOT NULL,
    `aggregateChatUserId` INTEGER NOT NULL,

    INDEX `link_attempt_defaultChatUserId_fkey`(`defaultChatUserId`),
    INDEX `link_attempt_aggregateChatUserId_fkey`(`aggregateChatUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `experience_transaction_originalUserId_fkey` ON `experience_transaction`(`originalUserId`);

-- AddForeignKey
ALTER TABLE `link_attempt` ADD CONSTRAINT `link_attempt_defaultChatUserId_fkey` FOREIGN KEY (`defaultChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `link_attempt` ADD CONSTRAINT `link_attempt_aggregateChatUserId_fkey` FOREIGN KEY (`aggregateChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
