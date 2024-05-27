-- This squashes all ~100 migrations and reduce the migrate:schema script runtime from several minutes to about 10 seconds

-- CreateTable
CREATE TABLE `twitch_auth` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `twitchUserId` VARCHAR(191) NULL,
    `twitchUsername` VARCHAR(191) NOT NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `refreshToken` VARCHAR(191) NOT NULL,
    `expiresIn` INTEGER NOT NULL,
    `obtainmentTimestamp` BIGINT NOT NULL,
    `scope` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `twitch_auth_twitchUserId_key`(`twitchUserId`),
    UNIQUE INDEX `twitch_auth_twitchUsername_key`(`twitchUsername`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `youtube_web_auth` (
    `channelId` VARCHAR(191) NOT NULL,
    `accessToken` VARCHAR(511) NOT NULL,
    `updateTime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`channelId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `youtube_auth` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalYoutubeChannelId` VARCHAR(191) NOT NULL,
    `timeObtained` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `refreshToken` VARCHAR(512) NOT NULL,
    `expiryDate` DATETIME(3) NOT NULL,
    `accessToken` VARCHAR(512) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `youtube_auth_externalYoutubeChannelId`(`externalYoutubeChannelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `youtube_livestream` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `liveId` VARCHAR(11) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `start` DATETIME(3) NULL,
    `end` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL,
    `continuationToken` VARCHAR(1023) NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `youtube_livestream_streamerId_fkey`(`streamerId`),
    UNIQUE INDEX `youtube_livestream_liveId_key`(`liveId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `youtube_live_viewer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `viewCount` INTEGER NOT NULL,
    `youtubeLivestreamId` INTEGER NOT NULL,

    INDEX `youtube_live_viewer_youtubeLivestreamId_fkey`(`youtubeLivestreamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twitch_livestream` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `twitch_livestream_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twitch_live_viewer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `viewCount` INTEGER NOT NULL,
    `twitchLivestreamId` INTEGER NOT NULL,

    INDEX `twitch_live_viewer_twitchLivestreamId_fkey`(`twitchLivestreamId`),
    INDEX `live_viewer_time_key`(`time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `linkedAt` DATETIME(3) NULL,
    `aggregateChatUserId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `link_attempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `log` VARCHAR(4096) NOT NULL,
    `errorMessage` VARCHAR(4096) NULL,
    `released` BOOLEAN NOT NULL DEFAULT true,
    `type` ENUM('link', 'unlink') NOT NULL,
    `defaultChatUserId` INTEGER NOT NULL,
    `aggregateChatUserId` INTEGER NOT NULL,
    `linkTokenId` INTEGER NULL,

    INDEX `link_attempt_defaultChatUserId_fkey`(`defaultChatUserId`),
    INDEX `link_attempt_aggregateChatUserId_fkey`(`aggregateChatUserId`),
    UNIQUE INDEX `link_attempt_linkTokenId_fkey`(`linkTokenId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `link_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `aggregateChatUserId` INTEGER NOT NULL,
    `defaultChatUserId` INTEGER NOT NULL,

    INDEX `link_token_aggregateChatUserId_fkey`(`aggregateChatUserId`),
    INDEX `link_token_defaultChatUserId_fkey`(`defaultChatUserId`),
    UNIQUE INDEX `link_token_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `registered_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(32) NOT NULL,
    `registeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `hashedPassword` VARCHAR(64) NOT NULL,
    `aggregateChatUserId` INTEGER NOT NULL,

    UNIQUE INDEX `registered_user_aggregateChatUserId_fkey`(`aggregateChatUserId`),
    UNIQUE INDEX `registered_user_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(8) NOT NULL,
    `registeredUserId` INTEGER NOT NULL,

    INDEX `login_token_registeredUserId_fkey`(`registeredUserId`),
    UNIQUE INDEX `login_token_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `streamer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `registeredUserId` INTEGER NOT NULL,

    UNIQUE INDEX `streamer_registeredUserId_fkey`(`registeredUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `streamer_application` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timeCreated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `message` VARCHAR(4095) NOT NULL,
    `timeClosed` DATETIME(3) NULL,
    `isApproved` BOOLEAN NULL,
    `closeMessage` VARCHAR(4095) NULL,
    `registeredUserId` INTEGER NOT NULL,

    INDEX `streamer_application_registeredUserId_fkey`(`registeredUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `youtube_channel_global_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `imageUrl` VARCHAR(511) NOT NULL,
    `isVerified` BOOLEAN NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `channelId` INTEGER NOT NULL,

    INDEX `youtube_channel_global_info_channelId_fkey`(`channelId`),
    INDEX `youtube_channel_global_info_time_key`(`time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `youtube_channel_streamer_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isOwner` BOOLEAN NOT NULL,
    `isModerator` BOOLEAN NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `channelId` INTEGER NOT NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `youtube_channel_streamer_info_channelId_fkey`(`channelId`),
    INDEX `youtube_channel_streamer_info_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `youtube_channel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `youtubeId` VARCHAR(63) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `youtube_channel_youtubeId_key`(`youtubeId`),
    UNIQUE INDEX `youtube_channel_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twitch_channel_global_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userName` VARCHAR(64) NOT NULL,
    `displayName` VARCHAR(64) NOT NULL,
    `userType` VARCHAR(32) NOT NULL,
    `colour` VARCHAR(8) NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `channelId` INTEGER NOT NULL,

    INDEX `twitch_channel_global_info_channelId_fkey`(`channelId`),
    INDEX `twitch_channel_global_info_time_key`(`time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twitch_channel_streamer_info` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isBroadcaster` BOOLEAN NOT NULL,
    `isSubscriber` BOOLEAN NOT NULL,
    `isMod` BOOLEAN NOT NULL,
    `isVip` BOOLEAN NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `channelId` INTEGER NOT NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `twitch_channel_streamer_info_channelId_fkey`(`channelId`),
    INDEX `twitch_channel_streamer_info_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twitch_channel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `twitchId` VARCHAR(32) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `twitch_channel_twitchId_key`(`twitchId`),
    UNIQUE INDEX `twitch_channel_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `streamer_youtube_channel_link` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timeAdded` DATETIME(3) NOT NULL,
    `timeRemoved` DATETIME(3) NULL,
    `streamerId` INTEGER NOT NULL,
    `youtubeChannelId` INTEGER NOT NULL,

    INDEX `streamer_youtube_channel_link_streamerId_fkey`(`streamerId`),
    INDEX `streamer_youtube_channel_link_youtubeChannelId_fkey`(`youtubeChannelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `streamer_twitch_channel_link` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timeAdded` DATETIME(3) NOT NULL,
    `timeRemoved` DATETIME(3) NULL,
    `streamerId` INTEGER NOT NULL,
    `twitchChannelId` INTEGER NOT NULL,

    INDEX `streamer_twitch_channel_link_streamerId_fkey`(`streamerId`),
    INDEX `streamer_twitch_channel_link_twitchChannelId_fkey`(`twitchChannelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twitch_follower` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `twitchUserId` VARCHAR(32) NOT NULL,
    `userName` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `twitch_follower_streamerId_fkey`(`streamerId`),
    UNIQUE INDEX `twitch_follower_streamerId_twitchUserId_key`(`streamerId`, `twitchUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_emoji` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `imageUrl` VARCHAR(511) NOT NULL,
    `name` VARCHAR(127) NULL,
    `label` VARCHAR(127) NULL,
    `isCustomEmoji` BOOLEAN NOT NULL,
    `imageId` INTEGER NOT NULL,

    INDEX `chat_emoji_imageId_key`(`imageId`),
    UNIQUE INDEX `chat_emoji_imageUrl_key`(`imageUrl`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_text` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isBold` BOOLEAN NOT NULL,
    `isItalics` BOOLEAN NOT NULL,
    `text` VARCHAR(500) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_cheer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` INTEGER NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `colour` VARCHAR(8) NOT NULL,
    `imageUrl` VARCHAR(512) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_custom_emoji` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `textId` INTEGER NULL,
    `emojiId` INTEGER NULL,
    `customEmojiVersionId` INTEGER NOT NULL,

    INDEX `chat_custom_emoji_emojiId_fkey`(`emojiId`),
    INDEX `chat_custom_emoji_customEmojiVersionId_fkey`(`customEmojiVersionId`),
    UNIQUE INDEX `chat_custom_emoji_textId_key`(`textId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_command` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `normalisedCommandName` VARCHAR(64) NOT NULL,
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `result` VARCHAR(1024) NULL,
    `error` VARCHAR(1024) NULL,
    `chatMessageId` INTEGER NOT NULL,

    UNIQUE INDEX `chat_command_chatMessageId_fkey`(`chatMessageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_message_part` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order` INTEGER NOT NULL,
    `chatMessageId` INTEGER NOT NULL,
    `textId` INTEGER NULL,
    `emojiId` INTEGER NULL,
    `cheerId` INTEGER NULL,
    `customEmojiId` INTEGER NULL,

    INDEX `chat_message_part_chatMessageId_fkey`(`chatMessageId`),
    INDEX `chat_message_part_emojiId_fkey`(`emojiId`),
    INDEX `chat_message_part_customEmojiId_fkey`(`customEmojiId`),
    UNIQUE INDEX `chat_message_part_order_chatMessageId_key`(`order`, `chatMessageId`),
    UNIQUE INDEX `chat_message_part_textId_key`(`textId`),
    UNIQUE INDEX `chat_message_part_cheerId_fkey`(`cheerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(255) NOT NULL,
    `time` DATETIME(3) NOT NULL,
    `deletedTime` DATETIME(3) NULL,
    `contextToken` VARCHAR(511) NULL,
    `streamerId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `youtubeChannelId` INTEGER NULL,
    `twitchChannelId` INTEGER NULL,
    `youtubeLivestreamId` INTEGER NULL,
    `twitchLivestreamId` INTEGER NULL,
    `donationId` INTEGER NULL,

    INDEX `chat_message_streamerId_fkey`(`streamerId`),
    INDEX `chat_message_userId_fkey`(`userId`),
    INDEX `chat_message_youtubeChannelId_fkey`(`youtubeChannelId`),
    INDEX `chat_message_twitchChannelId_fkey`(`twitchChannelId`),
    INDEX `chat_message_youtubeLivestreamId_fkey`(`youtubeLivestreamId`),
    INDEX `chat_message_twitchLivestreamId_fkey`(`twitchLivestreamId`),
    INDEX `chat_message_time_key`(`time`),
    UNIQUE INDEX `chat_message_externalId_key`(`externalId`),
    UNIQUE INDEX `chat_message_donationId_fkey`(`donationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `masterchat_action` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timeAdded` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `type` VARCHAR(64) NOT NULL,
    `data` VARCHAR(4096) NOT NULL,
    `time` DATETIME(3) NULL,
    `youtubeLivestreamId` INTEGER NOT NULL,

    INDEX `masterchat_action_youtubeLivestreamId_fkey`(`youtubeLivestreamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experience_transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL,
    `delta` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `originalUserId` INTEGER NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `experience_transaction_userId_fkey`(`userId`),
    INDEX `experience_transaction_originalUserId_fkey`(`originalUserId`),
    INDEX `experience_transaction_userId_time_key`(`userId`, `time`),
    INDEX `experience_transaction_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experience_snapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL,
    `experience` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `experience_snapshot_userId_fkey`(`userId`),
    INDEX `experience_snapshot_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experience_data_chat_message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `baseExperience` INTEGER NOT NULL,
    `viewershipStreakMultiplier` DOUBLE NOT NULL,
    `participationStreakMultiplier` DOUBLE NOT NULL,
    `spamMultiplier` DOUBLE NOT NULL,
    `messageQualityMultiplier` DOUBLE NOT NULL,
    `repetitionPenalty` DOUBLE NULL,
    `chatMessageId` INTEGER NOT NULL,
    `experienceTransactionId` INTEGER NOT NULL,

    UNIQUE INDEX `experience_data_chat_message_chatMessageId_key`(`chatMessageId`),
    UNIQUE INDEX `experience_data_chat_message_experienceTransactionId_key`(`experienceTransactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experience_data_admin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `message` VARCHAR(1023) NULL,
    `adminUserId` INTEGER NOT NULL,
    `experienceTransactionId` INTEGER NOT NULL,

    INDEX `experience_data_admin_adminUserId_fkey`(`adminUserId`),
    UNIQUE INDEX `experience_data_admin_experienceTransactionId_key`(`experienceTransactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custom_emoji` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `symbol` VARCHAR(32) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `custom_emoji_streamerId_key`(`streamerId`),
    UNIQUE INDEX `custom_emoji_streamerId_symbol_key`(`streamerId`, `symbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custom_emoji_version` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isActive` BOOLEAN NOT NULL,
    `modifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `version` INTEGER NOT NULL,
    `name` VARCHAR(63) NOT NULL,
    `imageId` INTEGER NOT NULL,
    `levelRequirement` SMALLINT UNSIGNED NOT NULL,
    `canUseInDonationMessage` BOOLEAN NOT NULL,
    `customEmojiId` INTEGER NOT NULL,

    INDEX `custom_emoji_imageId_key`(`imageId`),
    UNIQUE INDEX `custom_emoji_version_customEmojiId_version_key`(`customEmojiId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custom_emoji_rank_whitelist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customEmojiId` INTEGER NOT NULL,
    `rankId` INTEGER NOT NULL,

    UNIQUE INDEX `custom_emoji_rank_whitelist_customEmojiId_rankId_key`(`customEmojiId`, `rankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` ENUM('admin', 'owner', 'mod', 'famous', 'mute', 'timeout', 'ban', 'donator', 'supporter', 'member') NOT NULL,
    `displayNameNoun` VARCHAR(64) NOT NULL,
    `displayNameAdjective` VARCHAR(64) NOT NULL,
    `description` VARCHAR(1024) NULL,
    `group` ENUM('cosmetic', 'administration', 'punishment', 'donation') NOT NULL,

    UNIQUE INDEX `rank_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_rank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issuedAt` DATETIME(3) NOT NULL,
    `expirationTime` DATETIME(3) NULL,
    `message` VARCHAR(1024) NULL,
    `revokedTime` DATETIME(3) NULL,
    `revokeMessage` VARCHAR(1024) NULL,
    `rankId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `streamerId` INTEGER NULL,
    `assignedByUserId` INTEGER NULL,
    `revokedByUserId` INTEGER NULL,

    INDEX `user_rank_rankId_fkey`(`rankId`),
    INDEX `user_rank_userId_fkey`(`userId`),
    INDEX `user_rank_streamerId_fkey`(`streamerId`),
    INDEX `user_rank_expirationTime_key`(`expirationTime`),
    INDEX `user_rank_revokedTime_key`(`revokedTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custom_rank_name` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(8) NOT NULL,
    `isActive` BOOLEAN NOT NULL,
    `userId` INTEGER NOT NULL,
    `rankId` INTEGER NOT NULL,
    `streamerId` INTEGER NULL,

    INDEX `custom_rank_name_userId_fkey`(`userId`),
    INDEX `custom_rank_name_rankId_fkey`(`rankId`),
    INDEX `custom_rank_name_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rank_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isAdded` BOOLEAN NOT NULL,
    `serialisedData` VARCHAR(8192) NULL,
    `streamerId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `rankId` INTEGER NOT NULL,

    INDEX `rank_event_time_key`(`time`),
    INDEX `rank_event_streamerId_fkey`(`streamerId`),
    INDEX `rank_event_userId_fkey`(`userId`),
    INDEX `rank_event_rankId_fkey`(`rankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_api_call` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `platform` VARCHAR(16) NOT NULL,
    `endpoint` VARCHAR(128) NOT NULL,
    `payload` VARCHAR(1024) NULL,
    `error` VARCHAR(1024) NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `platform_api_call_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `donation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `streamlabsId` INTEGER NULL,
    `streamlabsUserId` INTEGER NULL,
    `time` DATETIME(3) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `formattedAmount` VARCHAR(191) NOT NULL,
    `name` VARCHAR(256) NOT NULL,
    `refundedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `streamerId` INTEGER NOT NULL,

    INDEX `donation_streamerId_fkey`(`streamerId`),
    UNIQUE INDEX `donation_streamlabsId_key`(`streamlabsId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `streamlabs_socket_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `token` VARCHAR(1024) NOT NULL,
    `streamerId` INTEGER NOT NULL,

    UNIQUE INDEX `streamlabs_socket_token_streamerId_fkey`(`streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `donation_link` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `linkIdentifier` VARCHAR(191) NOT NULL,
    `linkedAt` DATETIME(3) NOT NULL,
    `streamerId` INTEGER NOT NULL,
    `linkedUserId` INTEGER NOT NULL,
    `originalLinkedUserId` INTEGER NULL,

    INDEX `donation_link_streamerId_fkey`(`streamerId`),
    INDEX `donation_link_originalLinkedUserId_fkey`(`originalLinkedUserId`),
    UNIQUE INDEX `donation_link_linkIdentifier_streamerId_key`(`linkIdentifier`, `streamerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `image` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `modifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fingerprint` VARCHAR(191) NOT NULL,
    `originalUrl` VARCHAR(191) NULL,
    `url` VARCHAR(127) NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,

    UNIQUE INDEX `image_fingerprint_key`(`fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `youtube_livestream` ADD CONSTRAINT `youtube_livestream_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_live_viewer` ADD CONSTRAINT `youtube_live_viewer_youtubeLivestreamId_fkey` FOREIGN KEY (`youtubeLivestreamId`) REFERENCES `youtube_livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twitch_livestream` ADD CONSTRAINT `twitch_livestream_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twitch_live_viewer` ADD CONSTRAINT `twitch_live_viewer_twitchLivestreamId_fkey` FOREIGN KEY (`twitchLivestreamId`) REFERENCES `twitch_livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_user` ADD CONSTRAINT `chat_user_aggregateChatUserId_fkey` FOREIGN KEY (`aggregateChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `link_attempt` ADD CONSTRAINT `link_attempt_defaultChatUserId_fkey` FOREIGN KEY (`defaultChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `link_attempt` ADD CONSTRAINT `link_attempt_aggregateChatUserId_fkey` FOREIGN KEY (`aggregateChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `link_attempt` ADD CONSTRAINT `link_attempt_linkTokenId_fkey` FOREIGN KEY (`linkTokenId`) REFERENCES `link_token`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `link_token` ADD CONSTRAINT `link_token_aggregateChatUserId_fkey` FOREIGN KEY (`aggregateChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `link_token` ADD CONSTRAINT `link_token_defaultChatUserId_fkey` FOREIGN KEY (`defaultChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registered_user` ADD CONSTRAINT `registered_user_aggregateChatUserId_fkey` FOREIGN KEY (`aggregateChatUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_token` ADD CONSTRAINT `login_token_registeredUserId_fkey` FOREIGN KEY (`registeredUserId`) REFERENCES `registered_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamer` ADD CONSTRAINT `streamer_registeredUserId_fkey` FOREIGN KEY (`registeredUserId`) REFERENCES `registered_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamer_application` ADD CONSTRAINT `streamer_application_registeredUserId_fkey` FOREIGN KEY (`registeredUserId`) REFERENCES `registered_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_channel_global_info` ADD CONSTRAINT `youtube_channel_global_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `youtube_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_channel_streamer_info` ADD CONSTRAINT `youtube_channel_streamer_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `youtube_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_channel_streamer_info` ADD CONSTRAINT `youtube_channel_streamer_info_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_channel` ADD CONSTRAINT `youtube_channel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twitch_channel_global_info` ADD CONSTRAINT `twitch_channel_global_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `twitch_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twitch_channel_streamer_info` ADD CONSTRAINT `twitch_channel_streamer_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `twitch_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twitch_channel_streamer_info` ADD CONSTRAINT `twitch_channel_streamer_info_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twitch_channel` ADD CONSTRAINT `twitch_channel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamer_youtube_channel_link` ADD CONSTRAINT `streamer_youtube_channel_link_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamer_youtube_channel_link` ADD CONSTRAINT `streamer_youtube_channel_link_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `youtube_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamer_twitch_channel_link` ADD CONSTRAINT `streamer_twitch_channel_link_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamer_twitch_channel_link` ADD CONSTRAINT `streamer_twitch_channel_link_twitchChannelId_fkey` FOREIGN KEY (`twitchChannelId`) REFERENCES `twitch_channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twitch_follower` ADD CONSTRAINT `twitch_follower_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_emoji` ADD CONSTRAINT `chat_emoji_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `image`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_textId_fkey` FOREIGN KEY (`textId`) REFERENCES `chat_text`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_emojiId_fkey` FOREIGN KEY (`emojiId`) REFERENCES `chat_emoji`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_customEmojiVersionId_fkey` FOREIGN KEY (`customEmojiVersionId`) REFERENCES `custom_emoji_version`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_command` ADD CONSTRAINT `chat_command_chatMessageId_fkey` FOREIGN KEY (`chatMessageId`) REFERENCES `chat_message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_chatMessageId_fkey` FOREIGN KEY (`chatMessageId`) REFERENCES `chat_message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_textId_fkey` FOREIGN KEY (`textId`) REFERENCES `chat_text`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_emojiId_fkey` FOREIGN KEY (`emojiId`) REFERENCES `chat_emoji`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_cheerId_fkey` FOREIGN KEY (`cheerId`) REFERENCES `chat_cheer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `chat_custom_emoji`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `youtube_channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_twitchChannelId_fkey` FOREIGN KEY (`twitchChannelId`) REFERENCES `twitch_channel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_youtubeLivestreamId_fkey` FOREIGN KEY (`youtubeLivestreamId`) REFERENCES `youtube_livestream`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_twitchLivestreamId_fkey` FOREIGN KEY (`twitchLivestreamId`) REFERENCES `twitch_livestream`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message` ADD CONSTRAINT `chat_message_donationId_fkey` FOREIGN KEY (`donationId`) REFERENCES `donation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `masterchat_action` ADD CONSTRAINT `masterchat_action_youtubeLivestreamId_fkey` FOREIGN KEY (`youtubeLivestreamId`) REFERENCES `youtube_livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_transaction` ADD CONSTRAINT `experience_transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_transaction` ADD CONSTRAINT `experience_transaction_originalUserId_fkey` FOREIGN KEY (`originalUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_transaction` ADD CONSTRAINT `experience_transaction_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_snapshot` ADD CONSTRAINT `experience_snapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_snapshot` ADD CONSTRAINT `experience_snapshot_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_data_chat_message` ADD CONSTRAINT `experience_data_chat_message_chatMessageId_fkey` FOREIGN KEY (`chatMessageId`) REFERENCES `chat_message`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_data_chat_message` ADD CONSTRAINT `experience_data_chat_message_experienceTransactionId_fkey` FOREIGN KEY (`experienceTransactionId`) REFERENCES `experience_transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_data_admin` ADD CONSTRAINT `experience_data_admin_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_data_admin` ADD CONSTRAINT `experience_data_admin_experienceTransactionId_fkey` FOREIGN KEY (`experienceTransactionId`) REFERENCES `experience_transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_emoji` ADD CONSTRAINT `custom_emoji_streamerId_key` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_emoji_version` ADD CONSTRAINT `custom_emoji_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `image`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_emoji_version` ADD CONSTRAINT `custom_emoji_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `custom_emoji`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_emoji_rank_whitelist` ADD CONSTRAINT `custom_emoji_rank_whitelist_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `custom_emoji`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_emoji_rank_whitelist` ADD CONSTRAINT `custom_emoji_rank_whitelist_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_assignedByUserId_fkey` FOREIGN KEY (`assignedByUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_revokedByUserId_fkey` FOREIGN KEY (`revokedByUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_rank_name` ADD CONSTRAINT `custom_rank_name_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_rank_name` ADD CONSTRAINT `custom_rank_name_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_rank_name` ADD CONSTRAINT `custom_rank_name_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rank_event` ADD CONSTRAINT `rank_event_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rank_event` ADD CONSTRAINT `rank_event_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rank_event` ADD CONSTRAINT `rank_event_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_api_call` ADD CONSTRAINT `platform_api_call_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation` ADD CONSTRAINT `donation_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `streamlabs_socket_token` ADD CONSTRAINT `streamlabs_socket_token_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation_link` ADD CONSTRAINT `donation_link_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation_link` ADD CONSTRAINT `donation_link_linkedUserId_fkey` FOREIGN KEY (`linkedUserId`) REFERENCES `chat_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation_link` ADD CONSTRAINT `donation_link_originalLinkedUserId_fkey` FOREIGN KEY (`originalLinkedUserId`) REFERENCES `chat_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- and now, we seed!

-- populate ranks
INSERT INTO `rank` (`name`, `displayNameNoun`, `displayNameAdjective`, `description`, `group`)
VALUES
  ('owner', 'owner', 'owner', NULL, 'administration'),
  ('mod', 'mod', 'mod', NULL, 'administration'),
  ('famous', 'famous', 'famous', NULL, 'cosmetic'),
  ('ban', 'banned', 'ban', NULL, 'punishment'),
  ('timeout', 'timed out', 'timeout', NULL, 'punishment'),
  ('mute', 'muted', 'mute', NULL, 'punishment'),
  ('admin', 'admin', 'admin', 'System Administrator', 'administration'),
  ('donator', 'donator', 'donating', 'The user has made a donation.', 'donation'),
  ('supporter', 'supporter', 'supporting', 'The user has made a total of at least $50 in donations.', 'donation'),
  ('member', 'member', 'member', 'The user has donated at least once per month since at least the last 3 months.', 'donation');

-- create triggers
-- from 20221021214032_add_custom_emoji_version_trigger/migration.sql
CREATE DEFINER = CURRENT_USER TRIGGER `TRG_CHECK_EXISTING_ACTIVE_VERSION` BEFORE INSERT ON custom_emoji_version
FOR EACH ROW

BEGIN
  IF EXISTS (
    SELECT *
    FROM custom_emoji_version
    WHERE customEmojiId = NEW.customEmojiId
    AND isActive = TRUE
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DUPLICATE_ACTIVE_VERSION';
  END IF;
END;


-- from 20221104110906_add_streamer_id_column_to_user_rank_table/migration.sql
CREATE DEFINER = CURRENT_USER TRIGGER `TRG_CHECK_EXISTING_ACTIVE_RANK` BEFORE INSERT ON user_rank
FOR EACH ROW

BEGIN
  IF EXISTS (
    SELECT *
    FROM user_rank
    WHERE rankId = NEW.rankId
    AND userId = NEW.userId
    AND streamerId = NEW.streamerId -- ranks can only be duplicate under the same streamer context (including null, aka global ranks)
    AND revokedTime IS NULL -- we don't compare revoke times, this essentially acts as a "deactivated" field
    AND (
      expirationTime IS NOT NULL AND expirationTime > NEW.issuedAt
      OR expirationTime IS NULL
    )
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DUPLICATE_RANK';
  END IF;
END;
