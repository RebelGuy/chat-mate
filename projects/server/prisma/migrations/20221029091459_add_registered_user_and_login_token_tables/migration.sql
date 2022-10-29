-- CreateTable
CREATE TABLE `registered_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(32) NOT NULL,
    `registeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `hashedPassword` VARCHAR(64) NOT NULL,
    `chatUserId` INTEGER NULL,

    UNIQUE INDEX `registered_user_chatUser_fkey`(`chatUserId`),
    UNIQUE INDEX `registered_user_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(8) NOT NULL,
    `registeredUserId` INTEGER NOT NULL,

    INDEX `login_token_registeredUserId_fkey`(`registeredUserId`),
    UNIQUE INDEX `login_token_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `registered_user` ADD CONSTRAINT `registered_user_chatUser_fkey` FOREIGN KEY (`chatUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_token` ADD CONSTRAINT `login_token_registeredUserId_fkey` FOREIGN KEY (`registeredUserId`) REFERENCES `registered_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
