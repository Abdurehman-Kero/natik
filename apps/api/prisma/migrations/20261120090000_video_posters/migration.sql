-- Videos get a still picture shown before they play (a frame of the video or a chosen picture).
ALTER TYPE "FilePurpose" ADD VALUE 'VIDEO_POSTER';
ALTER TABLE "VideoAsset" ADD COLUMN "posterFileId" TEXT;
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_posterFileId_fkey" FOREIGN KEY ("posterFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
