/*
  Warnings:

  - The primary key for the `youtube_auth` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `channelId` on the `youtube_auth` table. All the data in the column will be lost.
  - You are about to drop the column `updateTime` on the `youtube_auth` table. All the data in the column will be lost.
  - You are about to alter the column `accessToken` on the `youtube_auth` table. The data in that column could be lost. The data in that column will be cast from `VarChar(511)` to `VarChar(191)`.
  - A unique constraint covering the columns `[externalYoutubeChannelId]` on the table `youtube_auth` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiryDate` to the `youtube_auth` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalYoutubeChannelId` to the `youtube_auth` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id` to the `youtube_auth` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idToken` to the `youtube_auth` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refreshToken` to the `youtube_auth` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scope` to the `youtube_auth` table without a default value. This is not possible if the table is not empty.

*/

ALTER TABLE `youtube_auth` RENAME TO `youtube_web_auth`;

CREATE TABLE `youtube_auth` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `externalYoutubeChannelId` VARCHAR(191) NOT NULL,
  `timeObtained` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `refreshToken` VARCHAR(512) NOT NULL,
  `expiryDate` DATETIME(3) NOT NULL,
  `accessToken` VARCHAR(512) NOT NULL,
  `scope` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `youtube_auth_externalYoutubeChannelId` ON `youtube_auth`(`externalYoutubeChannelId`);
