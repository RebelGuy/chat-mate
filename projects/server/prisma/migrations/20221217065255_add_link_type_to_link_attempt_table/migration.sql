/*
  Warnings:

  - Added the required column `type` to the `link_attempt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `link_attempt` ADD COLUMN `type` ENUM('link', 'unlink') NOT NULL;
