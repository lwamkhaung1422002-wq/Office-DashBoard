CREATE TYPE "AccessLevel" AS ENUM ('NORMAL', 'VIP', 'ADMIN');
CREATE TYPE "DataFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'ENUM');
CREATE TYPE "DataSourceType" AS ENUM ('EXCEL', 'MANUAL');

ALTER TABLE "DataRecord"
  ADD COLUMN "accessLevel" "AccessLevel" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "dataCollectionId" TEXT NOT NULL,
  ADD COLUMN "sourceImportId" TEXT,
  ADD COLUMN "sourceType" "DataSourceType" NOT NULL DEFAULT 'MANUAL';

CREATE TABLE "DataCollection" (
  "id" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "defaultAccessLevel" "AccessLevel" NOT NULL DEFAULT 'NORMAL',
  "archivedAt" TIMESTAMP(3), "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataField" (
  "id" TEXT NOT NULL, "dataCollectionId" TEXT NOT NULL, "key" TEXT NOT NULL,
  "label" TEXT NOT NULL, "type" "DataFieldType" NOT NULL, "position" INTEGER NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false, "options" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataField_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataCollection_categoryId_archivedAt_idx" ON "DataCollection"("categoryId", "archivedAt");
CREATE UNIQUE INDEX "DataCollection_categoryId_name_key" ON "DataCollection"("categoryId", "name");
CREATE INDEX "DataField_dataCollectionId_position_idx" ON "DataField"("dataCollectionId", "position");
CREATE UNIQUE INDEX "DataField_dataCollectionId_key_key" ON "DataField"("dataCollectionId", "key");
CREATE INDEX "DataRecord_dataCollectionId_archivedAt_createdAt_idx" ON "DataRecord"("dataCollectionId", "archivedAt", "createdAt");
CREATE INDEX "DataRecord_accessLevel_archivedAt_idx" ON "DataRecord"("accessLevel", "archivedAt");
CREATE INDEX "DataRecord_sourceImportId_idx" ON "DataRecord"("sourceImportId");

ALTER TABLE "DataCollection" ADD CONSTRAINT "DataCollection_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataCollection" ADD CONSTRAINT "DataCollection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataField" ADD CONSTRAINT "DataField_dataCollectionId_fkey" FOREIGN KEY ("dataCollectionId") REFERENCES "DataCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_dataCollectionId_fkey" FOREIGN KEY ("dataCollectionId") REFERENCES "DataCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
