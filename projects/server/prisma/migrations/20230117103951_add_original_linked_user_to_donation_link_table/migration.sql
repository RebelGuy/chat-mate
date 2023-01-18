-- AlterTable
ALTER TABLE `donation_link` ADD COLUMN `originalLinkedUserId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `donation_link_originalLinkedUserId_fkey` ON `donation_link`(`originalLinkedUserId`);

-- AddForeignKey
ALTER TABLE `donation_link` ADD CONSTRAINT `donation_link_originalLinkedUserId_fkey` FOREIGN KEY (`originalLinkedUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
