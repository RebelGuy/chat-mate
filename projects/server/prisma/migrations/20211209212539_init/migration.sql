-- CreateTable
CREATE TABLE `livestream` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `liveId` VARCHAR(11) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `continuationToken` VARCHAR(191) NULL,

    UNIQUE INDEX `Livestream_liveId_key`(`liveId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `channel_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `isOwner` BOOLEAN NOT NULL,
    `isModerator` BOOLEAN NOT NULL,
    `IsVerified` BOOLEAN NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `channelId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `channel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `youtubeId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Channel_youtubeId_key`(`youtubeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_emoji` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `youtubeId` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `imageWidth` SMALLINT NULL,
    `imageHeight` SMALLINT NULL,
    `name` VARCHAR(127) NULL,
    `label` VARCHAR(127) NULL,
    `isCustomEmoji` BOOLEAN NOT NULL,

    UNIQUE INDEX `chat_emoji_youtubeId_key`(`youtubeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_text` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isBold` BOOLEAN NOT NULL,
    `isItalics` BOOLEAN NOT NULL,
    `text` VARCHAR(200) NOT NULL,
    `chatMessagePartId` INTEGER NOT NULL,

    UNIQUE INDEX `chat_text_chatMessagePartId_key`(`chatMessagePartId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_message_part` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order` INTEGER NOT NULL,
    `chatMessageId` INTEGER NOT NULL,
    `textId` INTEGER NOT NULL,
    `emojiId` INTEGER NOT NULL,

    UNIQUE INDEX `chat_message_part_textId_key`(`textId`),
    UNIQUE INDEX `chat_message_part_order_chatMessageId_key`(`order`, `chatMessageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `youtubeId` VARCHAR(191) NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `channelId` INTEGER NOT NULL,
    `livestreamId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `channel_info` ADD CONSTRAINT `channel_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_chatMessageId_fkey` FOREIGN KEY (`chatMessageId`) REFERENCES `chat_message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_textId_fkey` FOREIGN KEY (`textId`) REFERENCES `chat_text`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_emojiId_fkey` FOREIGN KEY (`emojiId`) REFERENCES `chat_emoji`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
