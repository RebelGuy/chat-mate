CREATE DEFINER = CURRENT_USER TRIGGER `TRG_CHECK_EXISTING_ACTIVE_RANK` BEFORE INSERT ON user_rank
FOR EACH ROW

BEGIN
  IF EXISTS (
    SELECT *
    FROM user_rank
    WHERE rankId = NEW.rankId
    AND userId = NEW.userId
    AND revokedTime IS NULL -- we don't compare revoke times, this essentially acts as a "deactivated" field
    AND (
      expirationTime IS NOT NULL AND expirationTime > NEW.issuedAt
      OR expirationTime IS NULL
    )
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DUPLICATE_RANK';
  END IF;
END;
