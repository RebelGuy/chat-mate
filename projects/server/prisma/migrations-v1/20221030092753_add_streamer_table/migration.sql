-- DropForeignKey
ALTER TABLE `registered_user` DROP FOREIGN KEY `registered_user_chatUser_fkey`;

-- CreateTable
CREATE TABLE `streamer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `registeredUserId` INTEGER NOT NULL,

    UNIQUE INDEX `streamer_registeredUserId_fkey`(`registeredUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `registered_user` ADD CONSTRAINT `registered_user_chatUserId_fkey` FOREIGN KEY (`chatUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamer` ADD CONSTRAINT `streamer_registeredUserId_fkey` FOREIGN KEY (`registeredUserId`) REFERENCES `registered_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `registered_user` RENAME INDEX `registered_user_chatUser_fkey` TO `registered_user_chatUserId_fkey`;
