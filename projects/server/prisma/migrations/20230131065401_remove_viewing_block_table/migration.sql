/*
  Warnings:

  - You are about to drop the `viewing_block` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `viewing_block` DROP FOREIGN KEY `viewing_block_livestreamId_fkey`;

-- DropForeignKey
ALTER TABLE `viewing_block` DROP FOREIGN KEY `viewing_block_userId_fkey`;

-- DropTable
DROP TABLE `viewing_block`;

