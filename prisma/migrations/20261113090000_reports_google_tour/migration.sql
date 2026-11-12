-- AlterTable
ALTER TABLE `StudentProfile` ADD COLUMN `tourSeenAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `QuestionReport` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `status` ENUM('OPEN', 'FIXED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `adminNote` TEXT NULL,

    INDEX `QuestionReport_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `QuestionReport_questionId_idx`(`questionId`),
    INDEX `QuestionReport_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuestionReport` ADD CONSTRAINT `QuestionReport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionReport` ADD CONSTRAINT `QuestionReport_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

