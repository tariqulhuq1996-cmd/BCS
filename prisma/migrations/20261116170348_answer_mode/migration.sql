-- AlterTable
ALTER TABLE `AttemptAnswer` ADD COLUMN `eliminated` JSON NULL,
    ADD COLUMN `mode` ENUM('DIRECT', 'GUESS', 'SKIP') NULL;
