-- AlterTable
ALTER TABLE "events" ADD COLUMN     "end_time_estimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image_content_hash" TEXT,
ADD COLUMN     "source_image_url" TEXT,
ADD COLUMN     "superseded_by_id" TEXT;

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "shortcode" TEXT NOT NULL,
    "account_handle" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "posted_at" TIMESTAMPTZ(6),
    "incomplete_media" BOOLEAN NOT NULL DEFAULT false,
    "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "extraction" JSONB,
    "extraction_model" TEXT,
    "extraction_version" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMPTZ(6),
    "lease_token" TEXT,
    "lease_until" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "storage_path" TEXT,
    "public_url" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_event_mappings" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "title_key" TEXT NOT NULL,
    "local_date" TEXT NOT NULL,
    "candidate" JSONB NOT NULL,
    "event_id" TEXT,
    "image_index" INTEGER,
    "image_pending" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "social_event_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_posts_status_next_retry_at_lease_until_idx" ON "social_posts"("status", "next_retry_at", "lease_until");

-- CreateIndex
CREATE UNIQUE INDEX "social_posts_account_handle_shortcode_key" ON "social_posts"("account_handle", "shortcode");

-- CreateIndex
CREATE UNIQUE INDEX "social_media_post_id_identity_key" ON "social_media"("post_id", "identity");

-- CreateIndex
CREATE INDEX "social_event_mappings_event_id_idx" ON "social_event_mappings"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_event_mappings_post_id_slot_key" ON "social_event_mappings"("post_id", "slot");

-- AddForeignKey
ALTER TABLE "social_media" ADD CONSTRAINT "social_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_event_mappings" ADD CONSTRAINT "social_event_mappings_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Processing records are private; server-side database access bypasses RLS.
ALTER TABLE "social_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "social_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "social_event_mappings" ENABLE ROW LEVEL SECURITY;

-- Supabase bucket provisioning is optional when running against plain Postgres.
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('event-images', 'event-images', true, 10485760, ARRAY['image/webp'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
