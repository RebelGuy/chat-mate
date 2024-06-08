-- AlterTable
ALTER TABLE `user_rank` ADD COLUMN `streamerId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `user_rank_streamerId_fkey` ON `user_rank`(`streamerId`);

-- AddForeignKey
ALTER TABLE `user_rank` ADD CONSTRAINT `user_rank_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Update trigger
DROP TRIGGER `TRG_CHECK_EXISTING_ACTIVE_RANK`;

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
