-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('STUDENT', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    `disabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastLoginAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentProfile` (
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `targetBcs` INTEGER NOT NULL DEFAULT 52,
    `dailyGoalMin` INTEGER NOT NULL DEFAULT 120,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `userAgent` TEXT NULL,

    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateHit` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RateHit_key_at_idx`(`key`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PasswordResetToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `nameBn` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `marks200` INTEGER NOT NULL,

    UNIQUE INDEX `Subject_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Topic` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `nameBn` TEXT NOT NULL,
    `order` INTEGER NOT NULL,
    `priorityScore` DOUBLE NULL,
    `priorityGrade` ENUM('A', 'B', 'C', 'D') NULL,
    `estQuestions` DOUBLE NULL,

    UNIQUE INDEX `Topic_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subtopic` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `topicId` INTEGER NOT NULL,
    `nameBn` TEXT NOT NULL,
    `order` INTEGER NOT NULL,
    `priorityGrade` ENUM('A', 'B', 'C', 'D') NULL,
    `priorityScore` DOUBLE NULL,
    `histTotal` INTEGER NULL,
    `presenceAll` VARCHAR(191) NULL,
    `presence200` VARCHAR(191) NULL,
    `recentCount` INTEGER NULL,
    `trend` VARCHAR(191) NULL,
    `whyBn` TEXT NULL,
    `tipBn` TEXT NULL,
    `introBn` TEXT NULL,
    `targetQuestions` INTEGER NULL,

    UNIQUE INDEX `Subtopic_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Exam` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bcsNo` INTEGER NOT NULL,
    `type` ENUM('GENERAL_100', 'GENERAL_200', 'SPECIAL') NOT NULL,
    `expectedCount` INTEGER NOT NULL,
    `questionCount` INTEGER NOT NULL DEFAULT 0,
    `completeness` ENUM('COMPLETE', 'PARTIAL') NOT NULL DEFAULT 'COMPLETE',
    `notesBn` TEXT NULL,

    UNIQUE INDEX `Exam_bcsNo_key`(`bcsNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Question` (
    `id` VARCHAR(191) NOT NULL,
    `uid` VARCHAR(191) NOT NULL,
    `kind` ENUM('HISTORICAL', 'TOPIC') NOT NULL,
    `text` TEXT NOT NULL,
    `options` JSON NOT NULL,
    `correctIndex` INTEGER NULL,
    `explanation` TEXT NULL,
    `explanationStatus` ENUM('NONE', 'DRAFT', 'VERIFIED') NOT NULL DEFAULT 'NONE',
    `subtopicId` INTEGER NOT NULL,
    `difficulty` ENUM('EASY', 'MEDIUM', 'HARD') NULL,
    `questionType` VARCHAR(191) NULL,
    `source` TEXT NULL,
    `examId` INTEGER NULL,
    `examQNo` VARCHAR(191) NULL,
    `examPage` INTEGER NULL,
    `examSection` TEXT NULL,
    `verifyClass` VARCHAR(191) NULL,
    `verifyNote` TEXT NULL,
    `answerNote` TEXT NULL,
    `classConfidence` VARCHAR(191) NULL,
    `secondaryTag` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'VERIFIED', 'PUBLISHED', 'RETIRED') NOT NULL DEFAULT 'DRAFT',
    `textHash` VARCHAR(191) NOT NULL,
    `importBatchId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Question_uid_key`(`uid`),
    INDEX `Question_examId_idx`(`examId`),
    INDEX `Question_subtopicId_status_idx`(`subtopicId`, `status`),
    INDEX `Question_textHash_idx`(`textHash`),
    INDEX `Question_kind_status_idx`(`kind`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RepeatFamily` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupLabel` TEXT NULL,
    `sampleText` TEXT NOT NULL,
    `sampleOpts` TEXT NOT NULL,
    `subtopicBn` TEXT NOT NULL,
    `grade` ENUM('A', 'B', 'C', 'D') NULL,
    `occurrences` INTEGER NOT NULL,
    `matchType` VARCHAR(191) NOT NULL,
    `refs` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionFamily` (
    `familyId` INTEGER NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`familyId`, `questionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportBatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source` TEXT NOT NULL,
    `format` VARCHAR(191) NOT NULL,
    `rows` INTEGER NOT NULL,
    `inserted` INTEGER NOT NULL,
    `updated` INTEGER NOT NULL DEFAULT 0,
    `duplicates` INTEGER NOT NULL,
    `errors` JSON NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LearningLevel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `no` INTEGER NOT NULL,
    `nameBn` VARCHAR(191) NOT NULL,
    `descriptionBn` TEXT NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `LearningLevel_no_key`(`no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LearningTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `levelId` INTEGER NOT NULL,
    `kind` ENUM('L1_EXAM', 'L1_FINAL', 'L2_SUBTOPIC', 'L2_CHECKPOINT', 'L2_FINAL', 'L3_MODEL_TEST', 'L3_TIER_GATE') NOT NULL,
    `order` INTEGER NOT NULL,
    `phase` INTEGER NULL,
    `titleBn` TEXT NOT NULL,
    `mandatory` BOOLEAN NOT NULL DEFAULT true,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `examId` INTEGER NULL,
    `subtopicId` INTEGER NULL,
    `modelTestId` INTEGER NULL,

    UNIQUE INDEX `LearningTask_key_key`(`key`),
    INDEX `LearningTask_levelId_order_idx`(`levelId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskPrerequisite` (
    `taskId` INTEGER NOT NULL,
    `requiresId` INTEGER NOT NULL,

    PRIMARY KEY (`taskId`, `requiresId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RuleSetting` (
    `key` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'global',
    `value` JSON NOT NULL,
    `noteBn` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`key`, `scope`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentTaskProgress` (
    `userId` VARCHAR(191) NOT NULL,
    `taskId` INTEGER NOT NULL,
    `state` ENUM('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'LOCKED',
    `step` ENUM('SOLVE', 'REVIEW', 'REVISION', 'MASTERY', 'CUMULATIVE', 'DONE') NOT NULL DEFAULT 'SOLVE',
    `bestScore` DOUBLE NULL,
    `lastScore` DOUBLE NULL,
    `unlockedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `overrideBy` VARCHAR(191) NULL,
    `overrideAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudentTaskProgress_userId_state_idx`(`userId`, `state`),
    PRIMARY KEY (`userId`, `taskId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TestAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `taskId` INTEGER NULL,
    `kind` ENUM('SOLVE', 'REVISION', 'MASTERY', 'CUMULATIVE', 'PRACTICE', 'CHECKPOINT', 'LEVEL_FINAL', 'MODEL_TEST', 'SRS_REVIEW', 'MISTAKE_PRACTICE') NOT NULL,
    `partNo` INTEGER NOT NULL DEFAULT 1,
    `questionIds` JSON NOT NULL,
    `optionPerms` JSON NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deadlineAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `correct` INTEGER NULL,
    `wrong` INTEGER NULL,
    `unanswered` INTEGER NULL,
    `scorePct` DOUBLE NULL,
    `netScore` DOUBLE NULL,
    `threshold` DOUBLE NULL,
    `passed` BOOLEAN NULL,
    `reviewedAt` DATETIME(3) NULL,

    INDEX `TestAttempt_userId_taskId_kind_idx`(`userId`, `taskId`, `kind`),
    INDEX `TestAttempt_userId_submittedAt_idx`(`userId`, `submittedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttemptAnswer` (
    `attemptId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `selected` INTEGER NULL,
    `isCorrect` BOOLEAN NULL,
    `confidence` ENUM('SURE', 'UNSURE') NOT NULL DEFAULT 'SURE',
    `marked` BOOLEAN NOT NULL DEFAULT false,
    `timeMs` INTEGER NULL,

    INDEX `AttemptAnswer_questionId_idx`(`questionId`),
    PRIMARY KEY (`attemptId`, `questionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionStat` (
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `seen` INTEGER NOT NULL DEFAULT 0,
    `correct` INTEGER NOT NULL DEFAULT 0,
    `wrong` INTEGER NOT NULL DEFAULT 0,
    `lastCorrect` BOOLEAN NULL,
    `lowConfCorrect` INTEGER NOT NULL DEFAULT 0,
    `lastSeenAt` DATETIME(3) NULL,
    `lastWrongAt` DATETIME(3) NULL,
    `leitnerBox` INTEGER NOT NULL DEFAULT 0,
    `dueAt` DATETIME(3) NULL,
    `marked` BOOLEAN NOT NULL DEFAULT false,

    INDEX `QuestionStat_userId_dueAt_idx`(`userId`, `dueAt`),
    INDEX `QuestionStat_userId_wrong_idx`(`userId`, `wrong`),
    PRIMARY KEY (`userId`, `questionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RevisionSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `day` DATETIME(3) NOT NULL,
    `dueCount` INTEGER NOT NULL,
    `doneCount` INTEGER NOT NULL DEFAULT 0,
    `attemptIds` JSON NOT NULL,

    UNIQUE INDEX `RevisionSession_userId_day_key`(`userId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MasteryRecord` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `scope` ENUM('EXAM', 'SUBTOPIC', 'TOPIC', 'SUBJECT', 'LEVEL') NOT NULL,
    `scopeRef` VARCHAR(191) NOT NULL,
    `scorePct` DOUBLE NOT NULL,
    `attemptId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MasteryRecord_userId_scope_scopeRef_idx`(`userId`, `scope`, `scopeRef`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModelTest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `no` INTEGER NOT NULL,
    `tier` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `blueprint` JSON NOT NULL,
    `durationMin` INTEGER NOT NULL DEFAULT 120,
    `negativeMark` DOUBLE NOT NULL DEFAULT 0.5,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ModelTest_no_key`(`no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModelTestQuestion` (
    `modelTestId` INTEGER NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,

    UNIQUE INDEX `ModelTestQuestion_modelTestId_questionId_key`(`modelTestId`, `questionId`),
    PRIMARY KEY (`modelTestId`, `position`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bookmark` (
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `questionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Achievement` (
    `key` VARCHAR(191) NOT NULL,
    `nameBn` VARCHAR(191) NOT NULL,
    `descBn` TEXT NOT NULL,
    `icon` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserAchievement` (
    `userId` VARCHAR(191) NOT NULL,
    `achievementKey` VARCHAR(191) NOT NULL,
    `earnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `achievementKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `data` JSON NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaBank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` TEXT NOT NULL,
    `version` VARCHAR(191) NULL,
    `verifiedOn` DATETIME(3) NULL,
    `verifiedBn` VARCHAR(191) NULL,
    `howToUse` JSON NOT NULL,
    `questions` INTEGER NOT NULL,
    `importedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `importedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaChapter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `no` INTEGER NOT NULL,
    `nameBn` TEXT NOT NULL,

    UNIQUE INDEX `CaChapter_no_key`(`no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `no` INTEGER NOT NULL,
    `chapterId` INTEGER NOT NULL,
    `priority` ENUM('A', 'B', 'C', 'D') NOT NULL,
    `text` TEXT NOT NULL,
    `statements` JSON NULL,
    `stemTail` TEXT NULL,
    `options` JSON NOT NULL,
    `correctIndex` INTEGER NOT NULL,
    `explanation` TEXT NULL,
    `remember` TEXT NULL,
    `sourceText` TEXT NULL,
    `eventDate` TEXT NULL,
    `verifiedBn` VARCHAR(191) NULL,
    `volatile` BOOLEAN NOT NULL DEFAULT false,
    `volatileReason` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CaQuestion_no_key`(`no`),
    INDEX `CaQuestion_chapterId_priority_idx`(`chapterId`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaAnswer` (
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `seen` INTEGER NOT NULL DEFAULT 0,
    `correct` INTEGER NOT NULL DEFAULT 0,
    `lastCorrect` BOOLEAN NOT NULL,
    `box` INTEGER NOT NULL DEFAULT 1,
    `dueAt` DATETIME(3) NOT NULL,
    `lastAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CaAnswer_userId_dueAt_idx`(`userId`, `dueAt`),
    PRIMARY KEY (`userId`, `questionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaRevisionItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order` INTEGER NOT NULL,
    `group` TEXT NOT NULL,
    `topic` TEXT NOT NULL,
    `fact` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaSource` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `no` INTEGER NOT NULL,
    `name` TEXT NOT NULL,
    `url` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StudentProfile` ADD CONSTRAINT `StudentProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Topic` ADD CONSTRAINT `Topic_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subtopic` ADD CONSTRAINT `Subtopic_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_subtopicId_fkey` FOREIGN KEY (`subtopicId`) REFERENCES `Subtopic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `ImportBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionFamily` ADD CONSTRAINT `QuestionFamily_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `RepeatFamily`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionFamily` ADD CONSTRAINT `QuestionFamily_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningTask` ADD CONSTRAINT `LearningTask_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `LearningLevel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningTask` ADD CONSTRAINT `LearningTask_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningTask` ADD CONSTRAINT `LearningTask_subtopicId_fkey` FOREIGN KEY (`subtopicId`) REFERENCES `Subtopic`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningTask` ADD CONSTRAINT `LearningTask_modelTestId_fkey` FOREIGN KEY (`modelTestId`) REFERENCES `ModelTest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskPrerequisite` ADD CONSTRAINT `TaskPrerequisite_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `LearningTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskPrerequisite` ADD CONSTRAINT `TaskPrerequisite_requiresId_fkey` FOREIGN KEY (`requiresId`) REFERENCES `LearningTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentTaskProgress` ADD CONSTRAINT `StudentTaskProgress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentTaskProgress` ADD CONSTRAINT `StudentTaskProgress_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `LearningTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestAttempt` ADD CONSTRAINT `TestAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestAttempt` ADD CONSTRAINT `TestAttempt_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `LearningTask`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttemptAnswer` ADD CONSTRAINT `AttemptAnswer_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `TestAttempt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttemptAnswer` ADD CONSTRAINT `AttemptAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionStat` ADD CONSTRAINT `QuestionStat_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionStat` ADD CONSTRAINT `QuestionStat_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevisionSession` ADD CONSTRAINT `RevisionSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MasteryRecord` ADD CONSTRAINT `MasteryRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModelTestQuestion` ADD CONSTRAINT `ModelTestQuestion_modelTestId_fkey` FOREIGN KEY (`modelTestId`) REFERENCES `ModelTest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModelTestQuestion` ADD CONSTRAINT `ModelTestQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bookmark` ADD CONSTRAINT `Bookmark_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bookmark` ADD CONSTRAINT `Bookmark_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAchievement` ADD CONSTRAINT `UserAchievement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAchievement` ADD CONSTRAINT `UserAchievement_achievementKey_fkey` FOREIGN KEY (`achievementKey`) REFERENCES `Achievement`(`key`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaQuestion` ADD CONSTRAINT `CaQuestion_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `CaChapter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaAnswer` ADD CONSTRAINT `CaAnswer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaAnswer` ADD CONSTRAINT `CaAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `CaQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
