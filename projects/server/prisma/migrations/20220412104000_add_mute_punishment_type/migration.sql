-- AlterTable
ALTER TABLE `punishments` MODIFY `punishmentType` ENUM('ban', 'timeout', 'mute') NOT NULL;
