UPDATE `user_rank`
SET streamerId = 1
WHERE rankId IN (SELECT id FROM `rank` WHERE `name` != 'admin');
