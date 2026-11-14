-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('MOST_LIKELY_TO', 'ROAST_PROMPT', 'TRIVIA');

-- CreateEnum
CREATE TYPE "WordPackPurpose" AS ENUM ('IMPOSTOR', 'DRAWING');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "answer" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL,
    "purpose" "WordPackPurpose" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "relatedWord" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentItem_kind_language_isActive_idx" ON "ContentItem"("kind", "language", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_kind_language_text_key" ON "ContentItem"("kind", "language", "text");

-- CreateIndex
CREATE UNIQUE INDEX "WordPack_purpose_language_name_key" ON "WordPack"("purpose", "language", "name");

-- CreateIndex
CREATE INDEX "Word_packId_idx" ON "Word"("packId");

-- CreateIndex
CREATE UNIQUE INDEX "Word_packId_text_key" ON "Word"("packId", "text");

-- CreateIndex
CREATE INDEX "ContentReport_status_createdAt_idx" ON "ContentReport"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_packId_fkey" FOREIGN KEY ("packId") REFERENCES "WordPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
