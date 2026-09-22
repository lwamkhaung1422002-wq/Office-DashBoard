ALTER TABLE "User" ADD COLUMN "loginResetRequired" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "isPrimaryAdmin" = true
WHERE "id" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' AND "isActive" = true LIMIT 1)
  AND (SELECT COUNT(*) FROM "User" WHERE "role" = 'ADMIN' AND "isActive" = true) = 1
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "isPrimaryAdmin" = true);
