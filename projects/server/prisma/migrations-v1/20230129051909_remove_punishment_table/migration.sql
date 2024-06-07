/*
  Warnings:

  - You are about to drop the `punishment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `punishment` DROP FOREIGN KEY `punishment_adminUserId_fkey`;

-- DropForeignKey
ALTER TABLE `punishment` DROP FOREIGN KEY `punishment_userId_fkey`;

-- DropTable
DROP TABLE `punishment`;
