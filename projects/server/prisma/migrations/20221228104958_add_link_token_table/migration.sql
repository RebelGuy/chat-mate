/*
  Warnings:

  - A unique constraint covering the columns `[linkTokenId]` on the table `link_attempt` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `link_attempt` ADD COLUMN `linkTokenId` INTEGER NULL;

-- CreateTable
CREATE TABLE `link_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `aggregateChatUserId` INTEGER NOT NULL,
    `defaultChatUserId` INTEGER NOT NULL,

    INDEX `link_token_aggregateChatUserId_fkey`(`aggregateChatUserId`),
    INDEX `link_token_defaultChatUserId_fkey`(`defaultChatUserId`),
    UNIQUE INDEX `link_token_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `link_attempt_linkTokenId_fkey` ON `link_attempt`(`linkTokenId`);

-- AddForeignKey
ALTER TABLE `link_attempt` ADD CONSTRAINT `link_attempt_linkTokenId_fkey` FOREIGN KEY (`linkTokenId`) REFERENCES `link_token`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `link_token` ADD CONSTRAINT `link_token_aggregateChatUserId_fkey` FOREIGN KEY (`aggregateChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `link_token` ADD CONSTRAINT `link_token_defaultChatUserId_fkey` FOREIGN KEY (`defaultChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
