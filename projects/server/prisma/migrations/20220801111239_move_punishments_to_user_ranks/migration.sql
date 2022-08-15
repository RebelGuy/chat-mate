-- AlterTable
ALTER TABLE `rank` MODIFY `name` ENUM('owner', 'mod', 'famous', 'mute', 'timeout', 'ban') NOT NULL;

-- populate ranks
INSERT INTO `rank` (`name`, `displayName`, `group`)
VALUES
  ('owner', 'owner', 'administration'),
  ('mod', 'mod', 'administration'),
  ('famous', 'famous', 'cosmetic'),
  ('ban', 'banned', 'punishment'),
  ('timeout', 'timed out', 'punishment'),
  ('mute', 'muted', 'punishment');

-- copy punishment data
INSERT INTO user_rank (issuedAt, expirationTime, message, revokedTime, revokeMessage, rankId, userId, assignedByUserId)
SELECT
  issuedAt,
  expirationTime,
  NULLIF(message, ''), -- empty strings are converted to null
  revokedTime,
  NULLIF(revokeMessage, ''),
  (
    SELECT id
    FROM `rank`
    WHERE `name` = (
	  CASE
        WHEN punishmentType = 'ban' THEN 'ban'
        WHEN punishmentType = 'timeout' THEN 'timeout'
        WHEN punishmentType = 'mute' THEN 'mute'
      END
    )
    LIMIT 1
  ) AS rankId,
  userId,
  adminUserId
FROM punishment;
