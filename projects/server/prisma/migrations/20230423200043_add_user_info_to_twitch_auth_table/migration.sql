/*
  Warnings:

  - The primary key for the `twitch_auth` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `clientId` on the `twitch_auth` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[twitchUserId]` on the table `twitch_auth` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[twitchUsername]` on the table `twitch_auth` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id` to the `twitch_auth` table without a default value. This is not possible if the table is not empty.
  - Added the required column `twitchUsername` to the `twitch_auth` table without a default value. This is not possible if the table is not empty.

*/

TRUNCATE TABLE `twitch_auth`;

-- AlterTable
ALTER TABLE `twitch_auth` DROP PRIMARY KEY,
    DROP COLUMN `clientId`,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD COLUMN `twitchUserId` VARCHAR(191) NULL,
    ADD COLUMN `twitchUsername` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- CreateIndex
CREATE UNIQUE INDEX `twitch_auth_twitchUserId_key` ON `twitch_auth`(`twitchUserId`);

-- CreateIndex
CREATE UNIQUE INDEX `twitch_auth_twitchUsername_key` ON `twitch_auth`(`twitchUsername`);
