/*
  Warnings:

  - A unique constraint covering the columns `[twitchId]` on the table `twitch_channels` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `twich_channels_twitchId_key` ON `twitch_channels`(`twitchId`);
