-- AlterTable
ALTER TABLE `rank_event` ADD COLUMN `appliedByUserId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `rank_event` ADD CONSTRAINT `rank_event_appliedByUserId_fkey` FOREIGN KEY (`appliedByUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
