ALTER TABLE "Document"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "fileSize" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "accessLevel" "AccessLevel" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Document" ALTER COLUMN "fileSize" DROP DEFAULT;
CREATE INDEX "Document_accessLevel_archivedAt_createdAt_idx" ON "Document"("accessLevel", "archivedAt", "createdAt");
