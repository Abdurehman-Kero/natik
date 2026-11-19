-- Where a person is: country and city, plus gender, collected at registration and shown to admins.
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

ALTER TABLE "User"
  ADD COLUMN "gender" "Gender",
  ADD COLUMN "country" TEXT,
  ADD COLUMN "city" TEXT;

CREATE INDEX "User_country_idx" ON "User"("country");
