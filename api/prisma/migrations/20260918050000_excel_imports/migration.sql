CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'INSPECTED', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "ImportJob" (
  "id" TEXT NOT NULL, "originalFileName" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL, "fileSize" INTEGER NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
  "categoryId" TEXT NOT NULL, "dataCollectionId" TEXT,
  "sheetName" TEXT, "headerRow" INTEGER, "inspection" JSONB,
  "totalRows" INTEGER NOT NULL DEFAULT 0, "validRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0, "failureReason" TEXT,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportJob_storageKey_key" ON "ImportJob"("storageKey");
CREATE INDEX "ImportJob_categoryId_status_createdAt_idx" ON "ImportJob"("categoryId", "status", "createdAt");
CREATE INDEX "ImportJob_dataCollectionId_createdAt_idx" ON "ImportJob"("dataCollectionId", "createdAt");
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_sourceImportId_fkey" FOREIGN KEY ("sourceImportId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_dataCollectionId_fkey" FOREIGN KEY ("dataCollectionId") REFERENCES "DataCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
