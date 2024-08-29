-- DropIndex
DROP INDEX `visitor_visitorId_date_key` ON `visitor`;

-- AlterTable
ALTER TABLE `streamer` ADD COLUMN `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Remove existing data (it's not very important to keep around this short history of visitors, and makes the migration 10 times easier)
TRUNCATE TABLE `visitor`;

-- AlterTable
ALTER TABLE `visitor` DROP COLUMN `date`,
    ADD COLUMN `timeString` VARCHAR(31) NOT NULL,
    MODIFY `time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX `visitor_visitorId_timeString_key` ON `visitor`(`visitorId`, `timeString`);
