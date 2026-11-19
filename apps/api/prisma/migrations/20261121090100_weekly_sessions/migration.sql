-- Weekly sessions, admin approval for every enrolment, and introduction-only public pages.

-- A request to join a free course is "open" too: one per student and course.
DROP INDEX "Enrolment_open_per_student_course_key";
CREATE UNIQUE INDEX "Enrolment_open_per_student_course_key" ON "Enrolment"("studentId", "courseId") WHERE (status IN ('AWAITING_APPROVAL', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'ACTIVE'));

-- When a session takes place.
ALTER TABLE "Lesson" ADD COLUMN "sessionDate" TIMESTAMP(3);

-- Courses still adding sessions can't be completed yet.
ALTER TABLE "Course" ADD COLUMN "ongoing" BOOLEAN NOT NULL DEFAULT false;

-- The public site shows course introductions only: no lesson is a public sample any more.
UPDATE "Lesson" SET "isFreePreview" = false WHERE "isFreePreview" = true;
