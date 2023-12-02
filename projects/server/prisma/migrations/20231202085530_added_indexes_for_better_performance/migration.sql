-- CreateIndex
CREATE INDEX `chat_message_time_key` ON `chat_message`(`time`);

-- CreateIndex
CREATE INDEX `twitch_channel_info_time_key` ON `twitch_channel_info`(`time`);

-- CreateIndex
CREATE INDEX `youtube_channel_info_time_key` ON `youtube_channel_info`(`time`);
