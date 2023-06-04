-- This is an empty migration.

INSERT INTO `chat_user`
  VALUES ();

INSERT IGNORE INTO `registered_user` (`username`, `hashedPassword`, `aggregateChatUserId`)
  VALUES ('chatmate', 'a101c4c17a08e7950ab395524ac0141263f3f54d6d04cd399a9d2bac9cded560', LAST_INSERT_ID());

INSERT IGNORE INTO `user_rank` (`issuedAt`, `expirationTime`, `message`, `revokedTime`, `revokeMessage`, `rankId`, `userId`, `streamerId`, `assignedByUserId`, `revokedByUserId`)
SELECT 
  '1000-01-01' AS `issuedAt`,
  NULL AS `expirationTime`,
  'Initial System Admin' AS `message`,
  NULL AS `revokedTime`,
  NULL AS `revokeMessage`,
  (SELECT r.id FROM `rank` AS r WHERE r.name = 'admin' LIMIT 1) AS `rankId`,
  (SELECT ru.aggregateChatUserId FROM registered_user AS ru WHERE ru.userName = 'chatmate' LIMIT 1) AS `userId`,
  NULL AS `streamerId`,
  NULL AS `assignedByUserId`,
  NULL AS `revokedByUserId`
;
