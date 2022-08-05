-- AlterTable
ALTER TABLE `rank` MODIFY `name` ENUM('admin', 'owner', 'mod', 'famous', 'mute', 'timeout', 'ban') NOT NULL;

INSERT INTO `rank` (`name`, `displayNameNoun`, `displayNameAdjective`, `description`, `group`)
VALUES ('admin', 'admin', 'admin', 'System Administrator', 'administration');

-- add the initial channel (my Twitch channel doesn't exist yet - can be added in a later migration)
INSERT INTO `user_rank` (`issuedAt`, `expirationTime`, `message`, `revokedTime`, `revokeMessage`, `rankId`, `userId`, `assignedByUserId`, `revokedByUserId`)
VALUES (
	'1000-01-01',
    NULL,
    'Initial System Admin',
    NULL,
    NULL,
    (SELECT r.id FROM `rank` AS r WHERE r.name = 'admin'),
    (SELECT yt.userId FROM `youtube_channel` AS yt WHERE yt.youtubeId = 'UCBDVDOdE6HOvWdVHsEOeQRA'),
    NULL,
    NULL
);