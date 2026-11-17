-- Chat: delete a message, clear history, delete a chat (for one side only).
ALTER TABLE "Conversation" ADD COLUMN "ownerClearedAt" TIMESTAMP(3),
ADD COLUMN "peerClearedAt" TIMESTAMP(3),
ADD COLUMN "adminClearedAt" TIMESTAMP(3),
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
