-- Certificates are no longer issued automatically: the student confirms the name to print, then an
-- admin approves and sends the certificate.
CREATE TYPE "CertificateRequestStatus" AS ENUM ('AWAITING_NAME', 'AWAITING_APPROVAL', 'RETURNED', 'ISSUED');

CREATE TABLE "CertificateRequest" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "nameOnCertificate" TEXT,
    "status" "CertificateRequestStatus" NOT NULL DEFAULT 'AWAITING_NAME',
    "submittedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "certificateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CertificateRequest_enrolmentId_key" ON "CertificateRequest"("enrolmentId");
CREATE UNIQUE INDEX "CertificateRequest_certificateId_key" ON "CertificateRequest"("certificateId");
CREATE INDEX "CertificateRequest_status_submittedAt_idx" ON "CertificateRequest"("status", "submittedAt");
CREATE INDEX "CertificateRequest_studentId_idx" ON "CertificateRequest"("studentId");

ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
