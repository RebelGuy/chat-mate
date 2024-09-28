-- DropForeignKey
ALTER TABLE `platform_api_call` DROP FOREIGN KEY `platform_api_call_streamerId_fkey`;

-- AlterTable
ALTER TABLE `platform_api_call` MODIFY `streamerId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `platform_api_call` ADD CONSTRAINT `platform_api_call_streamerId_fkey` FOREIGN KEY (`streamerId`) REFERENCES `streamer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
