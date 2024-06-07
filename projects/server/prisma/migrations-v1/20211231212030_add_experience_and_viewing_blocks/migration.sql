-- CreateTable
CREATE TABLE `experience_transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL,
    `delta` INTEGER NOT NULL,
    `channelId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experience_snapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL,
    `experience` INTEGER NOT NULL,
    `channelId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experience_data_chat_message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chatMessageId` INTEGER NOT NULL,
    `experienceTransactionId` INTEGER NOT NULL,

    UNIQUE INDEX `experience_data_chat_message_chatMessageId_key`(`chatMessageId`),
    UNIQUE INDEX `experience_data_chat_message_experienceTransactionId_key`(`experienceTransactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `viewing_block` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `startTime` DATETIME(3) NOT NULL,
    `lastUpdate` DATETIME(3) NOT NULL,
    `isComplete` BOOLEAN NOT NULL DEFAULT false,
    `livestreamId` INTEGER NOT NULL,
    `channelId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `experience_transaction` ADD CONSTRAINT `experience_transaction_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_snapshot` ADD CONSTRAINT `experience_snapshot_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_data_chat_message` ADD CONSTRAINT `experience_data_chat_message_chatMessageId_fkey` FOREIGN KEY (`chatMessageId`) REFERENCES `chat_message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_data_chat_message` ADD CONSTRAINT `experience_data_chat_message_experienceTransactionId_fkey` FOREIGN KEY (`experienceTransactionId`) REFERENCES `experience_transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `viewing_block` ADD CONSTRAINT `viewing_block_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `viewing_block` ADD CONSTRAINT `viewing_block_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
