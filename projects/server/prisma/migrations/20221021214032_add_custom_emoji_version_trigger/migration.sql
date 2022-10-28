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
