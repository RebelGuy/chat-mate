-- CreateTable
CREATE TABLE `experience_data_admin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `message` VARCHAR(1023) NULL,
    `adminChannelId` INTEGER NOT NULL,
    `experienceTransactionId` INTEGER NOT NULL,

    UNIQUE INDEX `experience_data_admin_experienceTransactionId_key`(`experienceTransactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `experience_data_admin` ADD CONSTRAINT `experience_data_admin_adminChannelId_fkey` FOREIGN KEY (`adminChannelId`) REFERENCES `channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_data_admin` ADD CONSTRAINT `experience_data_admin_experienceTransactionId_fkey` FOREIGN KEY (`experienceTransactionId`) REFERENCES `experience_transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
