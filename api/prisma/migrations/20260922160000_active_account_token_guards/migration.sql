WITH ranked_invites AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY LOWER("email") ORDER BY "createdAt" DESC, "id" DESC) AS position
  FROM "AccountInvite"
  WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL
)
UPDATE "AccountInvite"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (SELECT "id" FROM ranked_invites WHERE position > 1);

WITH ranked_resets AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC, "id" DESC) AS position
  FROM "AccountPasswordResetToken"
  WHERE "usedAt" IS NULL AND "revokedAt" IS NULL
)
UPDATE "AccountPasswordResetToken"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (SELECT "id" FROM ranked_resets WHERE position > 1);

CREATE UNIQUE INDEX "AccountInvite_one_unresolved_per_email"
ON "AccountInvite" (LOWER("email"))
WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

CREATE UNIQUE INDEX "AccountPasswordResetToken_one_active_per_user"
ON "AccountPasswordResetToken" ("userId")
WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;
