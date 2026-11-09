-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "PriorityGrade" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('GENERAL_100', 'GENERAL_200', 'SPECIAL');

-- CreateEnum
CREATE TYPE "ExamCompleteness" AS ENUM ('COMPLETE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('HISTORICAL', 'TOPIC');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'VERIFIED', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ExplanationStatus" AS ENUM ('NONE', 'DRAFT', 'VERIFIED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('L1_EXAM', 'L1_FINAL', 'L2_SUBTOPIC', 'L2_CHECKPOINT', 'L2_FINAL', 'L3_MODEL_TEST', 'L3_TIER_GATE');

-- CreateEnum
CREATE TYPE "TaskState" AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CycleStep" AS ENUM ('SOLVE', 'REVIEW', 'REVISION', 'MASTERY', 'CUMULATIVE', 'DONE');

-- CreateEnum
CREATE TYPE "AttemptKind" AS ENUM ('SOLVE', 'REVISION', 'MASTERY', 'CUMULATIVE', 'PRACTICE', 'CHECKPOINT', 'LEVEL_FINAL', 'MODEL_TEST', 'SRS_REVIEW', 'MISTAKE_PRACTICE');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('SURE', 'UNSURE');

-- CreateEnum
CREATE TYPE "MasteryScope" AS ENUM ('EXAM', 'SUBTOPIC', 'TOPIC', 'SUBJECT', 'LEVEL');

-- CreateEnum
CREATE TYPE "ModelTestStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "targetBcs" INTEGER NOT NULL DEFAULT 52,
    "dailyGoalMin" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "marks200" INTEGER NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "nameBn" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "priorityScore" DOUBLE PRECISION,
    "priorityGrade" "PriorityGrade",

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtopic" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "topicId" INTEGER NOT NULL,
    "nameBn" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "priorityGrade" "PriorityGrade",
    "priorityScore" DOUBLE PRECISION,
    "histTotal" INTEGER,
    "presenceAll" TEXT,
    "presence200" TEXT,
    "recentCount" INTEGER,
    "trend" TEXT,
    "whyBn" TEXT,
    "tipBn" TEXT,
    "introBn" TEXT,
    "targetQuestions" INTEGER,

    CONSTRAINT "Subtopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" SERIAL NOT NULL,
    "bcsNo" INTEGER NOT NULL,
    "type" "ExamType" NOT NULL,
    "expectedCount" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "completeness" "ExamCompleteness" NOT NULL DEFAULT 'COMPLETE',
    "notesBn" TEXT,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "kind" "QuestionKind" NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER,
    "explanation" TEXT,
    "explanationStatus" "ExplanationStatus" NOT NULL DEFAULT 'NONE',
    "subtopicId" INTEGER NOT NULL,
    "difficulty" "Difficulty",
    "questionType" TEXT,
    "source" TEXT,
    "examId" INTEGER,
    "examQNo" TEXT,
    "examPage" INTEGER,
    "examSection" TEXT,
    "verifyClass" TEXT,
    "verifyNote" TEXT,
    "answerNote" TEXT,
    "classConfidence" TEXT,
    "secondaryTag" TEXT,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "textHash" TEXT NOT NULL,
    "importBatchId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepeatFamily" (
    "id" SERIAL NOT NULL,
    "groupLabel" TEXT,
    "sampleText" TEXT NOT NULL,
    "sampleOpts" TEXT NOT NULL,
    "subtopicBn" TEXT NOT NULL,
    "grade" "PriorityGrade",
    "occurrences" INTEGER NOT NULL,
    "matchType" TEXT NOT NULL,
    "refs" TEXT NOT NULL,

    CONSTRAINT "RepeatFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionFamily" (
    "familyId" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,

    CONSTRAINT "QuestionFamily_pkey" PRIMARY KEY ("familyId","questionId")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "inserted" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL,
    "errors" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningLevel" (
    "id" SERIAL NOT NULL,
    "no" INTEGER NOT NULL,
    "nameBn" TEXT NOT NULL,
    "descriptionBn" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LearningLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningTask" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "levelId" INTEGER NOT NULL,
    "kind" "TaskKind" NOT NULL,
    "order" INTEGER NOT NULL,
    "phase" INTEGER,
    "titleBn" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "examId" INTEGER,
    "subtopicId" INTEGER,
    "modelTestId" INTEGER,

    CONSTRAINT "LearningTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskPrerequisite" (
    "taskId" INTEGER NOT NULL,
    "requiresId" INTEGER NOT NULL,

    CONSTRAINT "TaskPrerequisite_pkey" PRIMARY KEY ("taskId","requiresId")
);

-- CreateTable
CREATE TABLE "RuleSetting" (
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "value" JSONB NOT NULL,
    "noteBn" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "RuleSetting_pkey" PRIMARY KEY ("key","scope")
);

-- CreateTable
CREATE TABLE "StudentTaskProgress" (
    "userId" TEXT NOT NULL,
    "taskId" INTEGER NOT NULL,
    "state" "TaskState" NOT NULL DEFAULT 'LOCKED',
    "step" "CycleStep" NOT NULL DEFAULT 'SOLVE',
    "bestScore" DOUBLE PRECISION,
    "lastScore" DOUBLE PRECISION,
    "unlockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "overrideBy" TEXT,
    "overrideAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentTaskProgress_pkey" PRIMARY KEY ("userId","taskId")
);

-- CreateTable
CREATE TABLE "TestAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" INTEGER,
    "kind" "AttemptKind" NOT NULL,
    "partNo" INTEGER NOT NULL DEFAULT 1,
    "questionIds" TEXT[],
    "optionPerms" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "correct" INTEGER,
    "wrong" INTEGER,
    "unanswered" INTEGER,
    "scorePct" DOUBLE PRECISION,
    "netScore" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptAnswer" (
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selected" INTEGER,
    "isCorrect" BOOLEAN,
    "confidence" "Confidence" NOT NULL DEFAULT 'SURE',
    "marked" BOOLEAN NOT NULL DEFAULT false,
    "timeMs" INTEGER,

    CONSTRAINT "AttemptAnswer_pkey" PRIMARY KEY ("attemptId","questionId")
);

-- CreateTable
CREATE TABLE "QuestionStat" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "seen" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "wrong" INTEGER NOT NULL DEFAULT 0,
    "lastCorrect" BOOLEAN,
    "lowConfCorrect" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "lastWrongAt" TIMESTAMP(3),
    "leitnerBox" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "marked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestionStat_pkey" PRIMARY KEY ("userId","questionId")
);

-- CreateTable
CREATE TABLE "RevisionSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "dueCount" INTEGER NOT NULL,
    "doneCount" INTEGER NOT NULL DEFAULT 0,
    "attemptIds" TEXT[],

    CONSTRAINT "RevisionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasteryRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "MasteryScope" NOT NULL,
    "scopeRef" TEXT NOT NULL,
    "scorePct" DOUBLE PRECISION NOT NULL,
    "attemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasteryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelTest" (
    "id" SERIAL NOT NULL,
    "no" INTEGER NOT NULL,
    "tier" INTEGER NOT NULL,
    "status" "ModelTestStatus" NOT NULL DEFAULT 'DRAFT',
    "blueprint" JSONB NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 120,
    "negativeMark" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ModelTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelTestQuestion" (
    "modelTestId" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ModelTestQuestion_pkey" PRIMARY KEY ("modelTestId","position")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("userId","questionId")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "key" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "descBn" TEXT NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId","achievementKey")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_code_key" ON "Topic"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subtopic_code_key" ON "Subtopic"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_bcsNo_key" ON "Exam"("bcsNo");

-- CreateIndex
CREATE UNIQUE INDEX "Question_uid_key" ON "Question"("uid");

-- CreateIndex
CREATE INDEX "Question_examId_idx" ON "Question"("examId");

-- CreateIndex
CREATE INDEX "Question_subtopicId_status_idx" ON "Question"("subtopicId", "status");

-- CreateIndex
CREATE INDEX "Question_textHash_idx" ON "Question"("textHash");

-- CreateIndex
CREATE INDEX "Question_kind_status_idx" ON "Question"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LearningLevel_no_key" ON "LearningLevel"("no");

-- CreateIndex
CREATE UNIQUE INDEX "LearningTask_key_key" ON "LearningTask"("key");

-- CreateIndex
CREATE INDEX "LearningTask_levelId_order_idx" ON "LearningTask"("levelId", "order");

-- CreateIndex
CREATE INDEX "StudentTaskProgress_userId_state_idx" ON "StudentTaskProgress"("userId", "state");

-- CreateIndex
CREATE INDEX "TestAttempt_userId_taskId_kind_idx" ON "TestAttempt"("userId", "taskId", "kind");

-- CreateIndex
CREATE INDEX "TestAttempt_userId_submittedAt_idx" ON "TestAttempt"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");

-- CreateIndex
CREATE INDEX "QuestionStat_userId_dueAt_idx" ON "QuestionStat"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "QuestionStat_userId_wrong_idx" ON "QuestionStat"("userId", "wrong");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSession_userId_day_key" ON "RevisionSession"("userId", "day");

-- CreateIndex
CREATE INDEX "MasteryRecord_userId_scope_scopeRef_idx" ON "MasteryRecord"("userId", "scope", "scopeRef");

-- CreateIndex
CREATE UNIQUE INDEX "ModelTest_no_key" ON "ModelTest"("no");

-- CreateIndex
CREATE UNIQUE INDEX "ModelTestQuestion_modelTestId_questionId_key" ON "ModelTestQuestion"("modelTestId", "questionId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtopic" ADD CONSTRAINT "Subtopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "Subtopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFamily" ADD CONSTRAINT "QuestionFamily_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "RepeatFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFamily" ADD CONSTRAINT "QuestionFamily_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningTask" ADD CONSTRAINT "LearningTask_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "LearningLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningTask" ADD CONSTRAINT "LearningTask_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningTask" ADD CONSTRAINT "LearningTask_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "Subtopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningTask" ADD CONSTRAINT "LearningTask_modelTestId_fkey" FOREIGN KEY ("modelTestId") REFERENCES "ModelTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPrerequisite" ADD CONSTRAINT "TaskPrerequisite_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LearningTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPrerequisite" ADD CONSTRAINT "TaskPrerequisite_requiresId_fkey" FOREIGN KEY ("requiresId") REFERENCES "LearningTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTaskProgress" ADD CONSTRAINT "StudentTaskProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTaskProgress" ADD CONSTRAINT "StudentTaskProgress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LearningTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LearningTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionStat" ADD CONSTRAINT "QuestionStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionStat" ADD CONSTRAINT "QuestionStat_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSession" ADD CONSTRAINT "RevisionSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryRecord" ADD CONSTRAINT "MasteryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelTestQuestion" ADD CONSTRAINT "ModelTestQuestion_modelTestId_fkey" FOREIGN KEY ("modelTestId") REFERENCES "ModelTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelTestQuestion" ADD CONSTRAINT "ModelTestQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementKey_fkey" FOREIGN KEY ("achievementKey") REFERENCES "Achievement"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
