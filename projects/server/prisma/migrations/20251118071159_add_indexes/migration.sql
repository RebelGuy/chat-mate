-- CreateIndex
CREATE INDEX `streamer_youtube_channel_link_timeRemoved_key` ON `streamer_youtube_channel_link`(`timeRemoved`);

-- CreateIndex
CREATE INDEX `twitch_livestream_end_key` ON `twitch_livestream`(`end`);

-- CreateIndex
CREATE INDEX `youtube_channel_streamer_info_time_key` ON `youtube_channel_streamer_info`(`time`);

-- CreateIndex
CREATE INDEX `youtube_livestream_isActive_key` ON `youtube_livestream`(`isActive`);
