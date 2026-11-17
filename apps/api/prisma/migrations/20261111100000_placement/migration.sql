-- Questions of the public "Find your level" check.
CREATE TABLE "PlacementQuestion" (
    "id" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "band" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlacementQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlacementQuestion_languageId_active_band_idx" ON "PlacementQuestion"("languageId", "active", "band");

ALTER TABLE "PlacementQuestion" ADD CONSTRAINT "PlacementQuestion_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
