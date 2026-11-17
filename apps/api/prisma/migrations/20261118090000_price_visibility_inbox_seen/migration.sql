-- Paid courses can hide their price on the public site; inbox messages remember when they were seen.
ALTER TABLE "Course" ADD COLUMN "showPrice" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "InboxMessage" ADD COLUMN "seenAt" TIMESTAMP(3);
