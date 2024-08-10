-- CreateTable
CREATE TABLE `visitor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitorId` VARCHAR(127) NOT NULL,
    `date` DATE NOT NULL DEFAULT (curdate()),
    `time` TIME NOT NULL DEFAULT (curtime()),

    UNIQUE INDEX `visitor_visitorId_date_key`(`visitorId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
