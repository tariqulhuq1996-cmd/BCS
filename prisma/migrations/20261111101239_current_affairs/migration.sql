-- CreateTable
CREATE TABLE "CaBank" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT,
    "verifiedOn" TIMESTAMP(3),
    "verifiedBn" TEXT,
    "howToUse" JSONB NOT NULL,
    "questions" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" TEXT,

    CONSTRAINT "CaBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaChapter" (
    "id" SERIAL NOT NULL,
    "no" INTEGER NOT NULL,
    "nameBn" TEXT NOT NULL,

    CONSTRAINT "CaChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaQuestion" (
    "id" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "priority" "PriorityGrade" NOT NULL,
    "text" TEXT NOT NULL,
    "statements" JSONB,
    "stemTail" TEXT,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "remember" TEXT,
    "sourceText" TEXT,
    "eventDate" TEXT,
    "verifiedBn" TEXT,
    "volatile" BOOLEAN NOT NULL DEFAULT false,
    "volatileReason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaAnswer" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "seen" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "lastCorrect" BOOLEAN NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 1,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaAnswer_pkey" PRIMARY KEY ("userId","questionId")
);

-- CreateTable
CREATE TABLE "CaRevisionItem" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "group" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "fact" TEXT NOT NULL,

    CONSTRAINT "CaRevisionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaSource" (
    "id" SERIAL NOT NULL,
    "no" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,

    CONSTRAINT "CaSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaChapter_no_key" ON "CaChapter"("no");

-- CreateIndex
CREATE UNIQUE INDEX "CaQuestion_no_key" ON "CaQuestion"("no");

-- CreateIndex
CREATE INDEX "CaQuestion_chapterId_priority_idx" ON "CaQuestion"("chapterId", "priority");

-- CreateIndex
CREATE INDEX "CaAnswer_userId_dueAt_idx" ON "CaAnswer"("userId", "dueAt");

-- AddForeignKey
ALTER TABLE "CaQuestion" ADD CONSTRAINT "CaQuestion_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CaChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaAnswer" ADD CONSTRAINT "CaAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaAnswer" ADD CONSTRAINT "CaAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CaQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
