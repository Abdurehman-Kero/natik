-- Guided lessons: stages, slides, external video and captions, lesson order, trailer, resume position.
ALTER TYPE "BlockType" ADD VALUE 'SLIDES';
ALTER TYPE "FilePurpose" ADD VALUE 'CAPTION';

CREATE TYPE "LessonStage" AS ENUM ('PREPARE', 'WATCH', 'REVISE', 'EXAMPLES');
CREATE TYPE "LessonOrder" AS ENUM ('OPEN', 'IN_ORDER');

ALTER TABLE "Course" ADD COLUMN "lessonOrder" "LessonOrder" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "trailerUrl" TEXT;

ALTER TABLE "Lesson" ADD COLUMN "description" TEXT,
ADD COLUMN "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "estimatedMinutes" INTEGER,
ADD COLUMN "alwaysOpen" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "LessonBlock" ADD COLUMN "stage" "LessonStage";

ALTER TABLE "VideoAsset" ADD COLUMN "externalUrl" TEXT,
ADD COLUMN "captionFileId" TEXT;

ALTER TABLE "LessonProgress" ADD COLUMN "stage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "videoPositions" JSONB;

CREATE TABLE "LessonSlide" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "imageFileId" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LessonSlide_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LessonSlide_blockId_position_idx" ON "LessonSlide"("blockId", "position");

ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_captionFileId_fkey" FOREIGN KEY ("captionFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LessonSlide" ADD CONSTRAINT "LessonSlide_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "LessonBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonSlide" ADD CONSTRAINT "LessonSlide_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
