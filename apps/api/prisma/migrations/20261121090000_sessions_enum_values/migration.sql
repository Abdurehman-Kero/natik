-- New values first, on their own: PostgreSQL can't use a new enum value in the same migration.
ALTER TYPE "EnrolmentStatus" ADD VALUE 'AWAITING_APPROVAL' BEFORE 'AWAITING_PAYMENT';
ALTER TYPE "BlockType" ADD VALUE 'FILE';
ALTER TYPE "FilePurpose" ADD VALUE 'LESSON_FILE';
