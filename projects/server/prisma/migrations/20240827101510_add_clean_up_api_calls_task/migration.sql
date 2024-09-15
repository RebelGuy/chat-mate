-- AlterTable
ALTER TABLE `task` MODIFY `taskType` ENUM('cleanUpYoutubeContextTokensTask', 'cleanUpApiCallsTask') NOT NULL;

-- add the new task (1 week)
INSERT INTO `task` (`taskType`, `intervalMs`) VALUES ('cleanUpApiCallsTask', 604800000);
