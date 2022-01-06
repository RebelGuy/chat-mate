/*
  Warnings:

  - Added the required column `baseExperience` to the `experience_data_chat_message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `messageQualityMultiplier` to the `experience_data_chat_message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `participationStreakMultiplier` to the `experience_data_chat_message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `spamMultiplier` to the `experience_data_chat_message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `viewershipStreakMultiplier` to the `experience_data_chat_message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `livestreamId` to the `experience_transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `experience_data_chat_message` ADD COLUMN `baseExperience` INTEGER NOT NULL,
    ADD COLUMN `messageQualityMultiplier` DOUBLE NOT NULL,
    ADD COLUMN `participationStreakMultiplier` DOUBLE NOT NULL,
    ADD COLUMN `spamMultiplier` DOUBLE NOT NULL,
    ADD COLUMN `viewershipStreakMultiplier` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `experience_transaction` ADD COLUMN `livestreamId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `experience_transaction` ADD CONSTRAINT `experience_transaction_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `Livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
