/*
  Warnings:

  - You are about to drop the `channel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `channel_info` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_custom_emoji` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_emoji` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_message_part` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customemoji` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `experience_snapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `experience_transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `livestream` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `liveviewers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `viewing_block` table. If the table is not empty, all the data it contains will be lost.

*/

RENAME TABLE `livestream` TO `livestreams`;
RENAME TABLE `liveviewers` TO `live_viewers`;
RENAME TABLE `channel_info` TO `youtube_channel_info`;
RENAME TABLE `channel` TO `youtube_channels`;
RENAME TABLE `chat_emoji` TO `chat_emojis`;
RENAME TABLE `chat_custom_emoji` TO `chat_custom_emojis`;
RENAME TABLE `chat_message_part` TO `chat_message_parts`;
RENAME TABLE `chat_message` TO `chat_messages`;
RENAME TABLE `experience_transaction` TO `experience_transactions`;
RENAME TABLE `experience_snapshot` TO `experience_snapshots`;
RENAME TABLE `viewing_block` TO `viewing_blocks`;
RENAME TABLE `customemoji` TO `custom_emojis`;
