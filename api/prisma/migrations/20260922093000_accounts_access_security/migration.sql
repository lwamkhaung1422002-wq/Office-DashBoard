ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_PROFILE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_INVITE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_SETUP_LINK_REGENERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_INVITE_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_SETUP_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_RESET_LOGIN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_PASSWORD_RESET_COMPLETED';

ALTER TABLE "User" ADD COLUMN "isPrimaryAdmin" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_single_primary_admin" ON "User" ("isPrimaryAdmin") WHERE "isPrimaryAdmin" = true;

ALTER TABLE "Category" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "DataCollection" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "DataRecord" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "Document" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "DashboardWidget" ADD COLUMN "updatedById" TEXT;

ALTER TABLE "Category" ADD CONSTRAINT "Category_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataCollection" ADD CONSTRAINT "DataCollection_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AccountInvite" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'NORMAL_VIEWER',
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountPasswordResetToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountPasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountInvite_tokenHash_key" ON "AccountInvite"("tokenHash");
CREATE INDEX "AccountInvite_email_acceptedAt_revokedAt_expiresAt_idx" ON "AccountInvite"("email", "acceptedAt", "revokedAt", "expiresAt");
CREATE INDEX "AccountInvite_createdById_createdAt_idx" ON "AccountInvite"("createdById", "createdAt");
CREATE UNIQUE INDEX "AccountPasswordResetToken_tokenHash_key" ON "AccountPasswordResetToken"("tokenHash");
CREATE INDEX "AccountPasswordResetToken_userId_usedAt_revokedAt_expiresAt_idx" ON "AccountPasswordResetToken"("userId", "usedAt", "revokedAt", "expiresAt");
CREATE INDEX "AccountPasswordResetToken_createdById_createdAt_idx" ON "AccountPasswordResetToken"("createdById", "createdAt");

ALTER TABLE "AccountInvite" ADD CONSTRAINT "AccountInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountPasswordResetToken" ADD CONSTRAINT "AccountPasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountPasswordResetToken" ADD CONSTRAINT "AccountPasswordResetToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
