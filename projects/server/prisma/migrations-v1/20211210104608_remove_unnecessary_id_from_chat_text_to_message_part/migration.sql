/*
  Warnings:

  - You are about to drop the column `chatMessagePartId` on the `chat_text` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `chat_text_chatMessagePartId_key` ON `chat_text`;

-- AlterTable
ALTER TABLE `chat_text` DROP COLUMN `chatMessagePartId`;
