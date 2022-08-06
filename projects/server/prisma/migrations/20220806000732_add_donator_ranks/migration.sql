-- AlterTable
ALTER TABLE `rank` MODIFY `name` ENUM('admin', 'owner', 'mod', 'famous', 'mute', 'timeout', 'ban', 'donator', 'supporter', 'member') NOT NULL;

INSERT INTO `rank` (`name`, `displayNameNoun`, `displayNameAdjective`, `description`, `group`)
VALUES
  ('donator', 'donator', 'donating', 'The user has made a donation.', 'donation'),
  ('supporter', 'supporter', 'supporting', 'The user has made a total of at least $50 in donations.', 'donation'),
  ('member', 'member', 'member', 'The user has donated at least once per month since at least the last 3 months.', 'donation');
