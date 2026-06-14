-- CreateEnum
CREATE TYPE "EventClassificationStatus" AS ENUM ('pending', 'classified', 'fallback', 'retry');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_fingerprint" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "club_name" TEXT NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "location_name" TEXT NOT NULL,
    "building_code" TEXT,
    "source_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "image_url" TEXT,
    "is_free_food" BOOLEAN NOT NULL DEFAULT false,
    "content_hash" TEXT NOT NULL,
    "classification_status" "EventClassificationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_classifications" (
    "event_id" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "primary_tag" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "vibes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "audiences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "format" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "classified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_classifications_pkey" PRIMARY KEY ("event_id"),
    CONSTRAINT "event_classifications_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 1)
);

-- CreateIndex
CREATE UNIQUE INDEX "events_source_fingerprint_key" ON "events"("source_fingerprint");

-- CreateIndex
CREATE INDEX "events_start_time_idx" ON "events"("start_time");

-- CreateIndex
CREATE INDEX "events_classification_status_idx" ON "events"("classification_status");

-- CreateIndex
CREATE INDEX "event_classifications_primary_tag_idx" ON "event_classifications"("primary_tag");

-- AddForeignKey
ALTER TABLE "event_classifications" ADD CONSTRAINT "event_classifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
