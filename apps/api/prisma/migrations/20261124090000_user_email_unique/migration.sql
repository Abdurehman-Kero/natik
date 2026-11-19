-- People sign in with their email address, so an address belongs to one account and is stored in lower case.
UPDATE "User" SET "email" = NULLIF(lower(btrim("email")), '') WHERE "email" IS NOT NULL;

-- If the same address was typed on more than one account, the oldest account keeps it.
UPDATE "User" u SET "email" = NULL
 WHERE u."email" IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM "User" o
      WHERE o."email" = u."email" AND (o."createdAt", o."id") < (u."createdAt", u."id")
   );

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
