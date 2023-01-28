INSERT IGNORE INTO `user_rank` (`issuedAt`, `expirationTime`, `message`, `revokedTime`, `revokeMessage`, `rankId`, `userId`, `streamerId`, `assignedByRegisteredUserId`, `revokedByRegisteredUserId`)
SELECT 
  '1000-01-01' AS `issuedAt`,
  NULL AS `expirationTime`,
  'Initial Owner Rank' AS `message`,
  NULL AS `revokedTime`,
  NULL AS `reovkeMessage`,
  (SELECT r.id FROM `rank` AS r WHERE r.name = 'owner' LIMIT 1) AS `rankId`,
  (SELECT ru.aggregateChatUserId FROM registered_user AS ru WHERE ru.userName = 'rebel_guy' LIMIT 1) AS `userId`,
  (SELECT s.id FROM streamer AS s WHERE s.registeredUserId = (SELECT ru.id FROM registered_user AS ru WHERE ru.userName = 'rebel_guy') LIMIT 1) AS `streamerId`,
  NULL AS `assignedByRegisteredUserId`,
  NULL AS `revokedByRegisteredUserId`
;
