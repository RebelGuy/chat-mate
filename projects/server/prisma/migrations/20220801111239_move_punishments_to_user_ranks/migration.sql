-- AlterTable
ALTER TABLE `rank` MODIFY `name` ENUM('owner', 'mod', 'famous', 'muted', 'timed_out', 'banned') NOT NULL;

-- populate ranks
INSERT INTO `rank` (`name`, `displayName`, `group`)
VALUES
  ('owner', 'owner', 'administration'),
  ('mod', 'mod', 'administration'),
  ('famous', 'famous', 'cosmetic'),
  ('banned', 'banned', 'punishment'),
  ('timed_out', 'timed out', 'punishment'),
  ('muted', 'muted', 'punishment');

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
        WHEN punishmentType = 'ban' THEN 'banned'
        WHEN punishmentType = 'timeout' THEN 'timed_out'
        WHEN punishmentType = 'mute' THEN 'muted'
      END
    )
    LIMIT 1
  ) AS rankId,
  userId,
  adminUserId
FROM punishment;
