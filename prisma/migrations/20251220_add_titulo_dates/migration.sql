-- AlterTable: Add startDate and endDate to titulos
-- Step 1: Add columns as nullable
ALTER TABLE "titulos" ADD COLUMN "startDate" DATE;
ALTER TABLE "titulos" ADD COLUMN "endDate" DATE;

-- Step 2: Update existing titulos with dates calculated from their events
-- If titulo has events, use MIN/MAX of event dates
-- If titulo has no events, use season dates
UPDATE "titulos" t SET
  "startDate" = COALESCE(
    (SELECT MIN(e."date") FROM "events" e WHERE e."tituloId" = t.id),
    (SELECT s."startDate"::date FROM "seasons" s WHERE s.id = t."seasonId")
  ),
  "endDate" = COALESCE(
    (SELECT MAX(e."date") FROM "events" e WHERE e."tituloId" = t.id),
    (SELECT s."endDate"::date FROM "seasons" s WHERE s.id = t."seasonId")
  );

-- Step 3: For any titulos still with NULL (shouldn't happen but safety), use current date
UPDATE "titulos" SET "startDate" = CURRENT_DATE WHERE "startDate" IS NULL;
UPDATE "titulos" SET "endDate" = CURRENT_DATE WHERE "endDate" IS NULL;

-- Step 4: Make columns NOT NULL
ALTER TABLE "titulos" ALTER COLUMN "startDate" SET NOT NULL;
ALTER TABLE "titulos" ALTER COLUMN "endDate" SET NOT NULL;

-- Step 5: Create index for date range queries
CREATE INDEX "titulos_startDate_endDate_idx" ON "titulos"("startDate", "endDate");
