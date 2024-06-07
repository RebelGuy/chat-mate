-- AlterTable
ALTER TABLE `rank` MODIFY `name` ENUM('admin', 'owner', 'mod', 'famous', 'mute', 'timeout', 'ban') NOT NULL;

INSERT INTO `rank` (`name`, `displayNameNoun`, `displayNameAdjective`, `description`, `group`)
VALUES ('admin', 'admin', 'admin', 'System Administrator', 'administration');

-- add the initial channel (my Twitch channel doesn't exist yet - can be added in a later migration)
INSERT IGNORE INTO `user_rank` (`issuedAt`, `expirationTime`, `message`, `revokedTime`, `revokeMessage`, `rankId`, `userId`, `assignedByUserId`, `revokedByUserId`)
SELECT 
  '1000-01-01' AS `issuedAt`,
  NULL AS `expirationTime`,
  'Initial System Admin' AS `message`,
  NULL AS `revokedTime`,
  NULL AS `reovkeMessage`,
  (SELECT r.id FROM `rank` AS r WHERE r.name = 'admin' LIMIT 1) AS `rankId`,
  (SELECT yt.userId FROM youtube_channel AS yt WHERE yt.youtubeId = 'UCBDVDOdE6HOvWdVHsEOeQRA' LIMIT 1) AS `userId`,
  NULL AS `assignedByUserId`,
  NULL AS `revokedByUserId`
;
