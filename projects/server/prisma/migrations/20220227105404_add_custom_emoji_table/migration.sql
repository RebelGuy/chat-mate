-- CreateTable
CREATE TABLE `customemoji` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `symbol` VARCHAR(10) NOT NULL,
    `name` VARCHAR(63) NOT NULL,
    `image` BLOB NOT NULL,
    `levelRequirement` SMALLINT UNSIGNED NOT NULL,

    UNIQUE INDEX `CustomEmoji_symbol_key`(`symbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
