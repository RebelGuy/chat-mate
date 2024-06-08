/*
  Warnings:

  - Added the required column `log` to the `link_attempt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `link_attempt` ADD COLUMN `log` VARCHAR(4096) NOT NULL;
