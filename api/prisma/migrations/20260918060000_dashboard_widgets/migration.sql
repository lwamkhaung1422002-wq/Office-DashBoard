CREATE TYPE "ChartType" AS ENUM ('KPI', 'PIE', 'BAR', 'LINE', 'CATEGORY_SUMMARY');
CREATE TYPE "AggregationType" AS ENUM ('COUNT', 'SUM', 'AVG', 'MIN', 'MAX');
CREATE TYPE "TimeGrouping" AS ENUM ('DAY', 'MONTH', 'QUARTER', 'YEAR');

CREATE TABLE "DashboardWidget" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "dataCollectionId" TEXT NOT NULL,
  "chartType" "ChartType" NOT NULL, "dimensionFieldId" TEXT, "measureFieldId" TEXT,
  "aggregation" "AggregationType" NOT NULL, "timeGrouping" "TimeGrouping",
  "savedFilters" JSONB, "accessLevel" "AccessLevel" NOT NULL DEFAULT 'NORMAL',
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3), "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DashboardWidget_accessLevel_isActive_archivedAt_sortOrder_idx" ON "DashboardWidget"("accessLevel", "isActive", "archivedAt", "sortOrder");
CREATE INDEX "DashboardWidget_dataCollectionId_archivedAt_idx" ON "DashboardWidget"("dataCollectionId", "archivedAt");
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_dataCollectionId_fkey" FOREIGN KEY ("dataCollectionId") REFERENCES "DataCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_dimensionFieldId_fkey" FOREIGN KEY ("dimensionFieldId") REFERENCES "DataField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_measureFieldId_fkey" FOREIGN KEY ("measureFieldId") REFERENCES "DataField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
