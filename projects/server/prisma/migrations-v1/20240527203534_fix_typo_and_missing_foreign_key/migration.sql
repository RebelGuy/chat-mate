-- the original migration had a typo in the index name
ALTER TABLE `user_rank` RENAME INDEX `user_rank_revokedBydUserId_fkey` TO `user_rank_revokedByUserId_fkey`;

-- AddForeignKey
ALTER TABLE `experience_transaction` ADD CONSTRAINT `experience_transaction_originalUserId_fkey` FOREIGN KEY (`originalUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
