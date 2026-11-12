-- CreateTable
CREATE TABLE `PendingSignup` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PendingSignup_email_key`(`email`),
    INDEX `PendingSignup_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- যাচাই-বাকি শিক্ষার্থী-অ্যাকাউন্ট (কোড কখনো মেলেনি, তাই কখনো চালু হয়নি) মুছে ফেলা —
-- এখন থেকে কোড মিললে তবেই অ্যাকাউন্ট তৈরি হয়। সম্পর্কিত সব সারি ON DELETE CASCADE-এ মোছে।
DELETE FROM `User` WHERE `emailVerifiedAt` IS NULL AND `role` = 'STUDENT';
