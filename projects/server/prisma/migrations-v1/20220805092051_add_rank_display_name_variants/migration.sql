/*
  Warnings:

  - You are about to drop the column `displayName` on the `rank` table. All the data in the column will be lost.
  - The values [muted,timed_out,banned] on the enum `rank_name` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `displayNameAdjective` to the `rank` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayNameNoun` to the `rank` table without a default value. This is not possible if the table is not empty.

*/

ALTER TABLE `rank`
  RENAME COLUMN `displayName` TO `displayNameAdjective`,
  ADD COLUMN `displayNameNoun` VARCHAR(64) NOT NULL;

-- noun is the same as name for the existing records
UPDATE `rank` SET `displayNameNoun` = `name`;
