-- CreateTable
CREATE TABLE `WritingCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `subjectName` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `paper` VARCHAR(191) NULL,
    `section` TEXT NOT NULL,
    `marks` INTEGER NULL,
    `title` TEXT NOT NULL,
    `kind` VARCHAR(191) NULL,
    `info` TEXT NULL,
    `ref` TEXT NULL,
    `note` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WritingCard_code_key`(`code`),
    UNIQUE INDEX `WritingCard_subject_order_key`(`subject`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WritingCardRead` (
    `userId` VARCHAR(191) NOT NULL,
    `cardId` INTEGER NOT NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WritingCardRead_cardId_idx`(`cardId`),
    PRIMARY KEY (`userId`, `cardId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WritingCardRead` ADD CONSTRAINT `WritingCardRead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WritingCardRead` ADD CONSTRAINT `WritingCardRead_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `WritingCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
