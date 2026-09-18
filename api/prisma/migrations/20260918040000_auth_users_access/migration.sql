-- The legacy User table is empty (verified before this migration), so it can
-- be evolved safely to the authenticated account model used by the API.
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'NORMAL_VIEWER', 'VIP_VIEWER');

CREATE TYPE "AuditAction" AS ENUM (
  'USER_CREATED', 'USER_ACCESS_CHANGED', 'USER_DISABLED', 'USER_ENABLED',
  'USER_PASSWORD_RESET', 'USER_PASSWORD_CHANGED', 'CATEGORY_CREATED',
  'CATEGORY_UPDATED', 'CATEGORY_MOVED', 'CATEGORY_ARCHIVED',
  'CATEGORY_RESTORED', 'EXCEL_INSPECTED', 'EXCEL_IMPORTED', 'IMPORT_FAILED',
  'IMPORT_CANCELLED', 'DATA_CREATED', 'DATA_UPDATED', 'DATA_ARCHIVED',
  'DATA_RESTORED', 'DOCUMENT_UPLOADED', 'DOCUMENT_UPDATED',
  'DOCUMENT_ARCHIVED', 'DOCUMENT_RESTORED', 'DASHBOARD_WIDGET_CREATED',
  'DASHBOARD_WIDGET_UPDATED', 'DASHBOARD_WIDGET_ARCHIVED', 'REPORT_EXPORTED'
);

DROP INDEX "User_username_key";
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
  DROP COLUMN "password",
  DROP COLUMN "username",
  ADD COLUMN "email" TEXT NOT NULL,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "passwordHash" TEXT NOT NULL,
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'NORMAL_VIEWER',
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" SET DATA TYPE TEXT,
  ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "parentId" TEXT,
  "archivedAt" TIMESTAMP(3), "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataRecord" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "categoryId" TEXT NOT NULL, "createdById" TEXT,
  "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL, "createdById" TEXT,
  "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL, "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "actorId" TEXT,
  "before" JSONB, "after" JSONB, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");
CREATE INDEX "Category_parentId_archivedAt_sortOrder_idx" ON "Category"("parentId", "archivedAt", "sortOrder");
CREATE INDEX "Category_archivedAt_name_idx" ON "Category"("archivedAt", "name");
CREATE UNIQUE INDEX "Category_parentId_name_key" ON "Category"("parentId", "name");
CREATE INDEX "DataRecord_categoryId_archivedAt_idx" ON "DataRecord"("categoryId", "archivedAt");
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");
CREATE INDEX "Document_categoryId_archivedAt_idx" ON "Document"("categoryId", "archivedAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
