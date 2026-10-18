CREATE TYPE "public"."activity_source" AS ENUM('ai', 'user');--> statement-breakpoint
CREATE TYPE "public"."cover_source" AS ENUM('unsplash', 'pexels', 'none');--> statement-breakpoint
CREATE TYPE "public"."generation_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."price_band" AS ENUM('budget', 'mid', 'upscale');--> statement-breakpoint
CREATE TYPE "public"."trip_pace" AS ENUM('relaxed', 'balanced', 'packed');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('draft', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."usage_kind" AS ENUM('generation', 'chat_turn', 'places');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_day_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"start_time" text,
	"duration_minutes" integer,
	"est_cost_amount" numeric(12, 2),
	"est_cost_currency" text,
	"notes" text,
	"place_id" text,
	"place_name" text,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"maps_url" text,
	"booking_url" text,
	"source" "activity_source" DEFAULT 'ai' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "generation_job_status" DEFAULT 'queued' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"inngest_run_id" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"token" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "trip_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"date" date NOT NULL,
	"title" text,
	"summary" text,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_lodging" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"name" text NOT NULL,
	"neighborhood" text,
	"price_band" "price_band" NOT NULL,
	"place_id" text,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"maps_url" text
);
--> statement-breakpoint
CREATE TABLE "trip_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" text,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"revision" integer NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" "trip_status" DEFAULT 'draft' NOT NULL,
	"destination_name" text NOT NULL,
	"destination_place_id" text,
	"lat" double precision,
	"lng" double precision,
	"country_code" text,
	"timezone" text,
	"start_date" date NOT NULL,
	"days" integer NOT NULL,
	"adults" integer DEFAULT 1 NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"budget_amount" numeric(12, 2),
	"budget_currency" text,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"pace" "trip_pace" DEFAULT 'balanced' NOT NULL,
	"dietary" text[] DEFAULT '{}'::text[] NOT NULL,
	"accessibility" text[] DEFAULT '{}'::text[] NOT NULL,
	"cover_url" text,
	"cover_imagekit_url" text,
	"cover_source" "cover_source" DEFAULT 'none' NOT NULL,
	"cover_photographer" text,
	"cover_photographer_url" text,
	"cover_source_url" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"trip_id" uuid,
	"kind" "usage_kind" NOT NULL,
	"est_cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"avatar_url" text,
	"imagekit_file_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_trip_day_id_trip_days_id_fk" FOREIGN KEY ("trip_day_id") REFERENCES "public"."trip_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_lodging" ADD CONSTRAINT "trip_lodging_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_messages" ADD CONSTRAINT "trip_messages_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_messages" ADD CONSTRAINT "trip_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_day_sort_idx" ON "activities" USING btree ("trip_day_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_jobs_one_active_idx" ON "generation_jobs" USING btree ("trip_id") WHERE "generation_jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "share_links_token_idx" ON "share_links" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_days_trip_sort_idx" ON "trip_days" USING btree ("trip_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_lodging_trip_sort_idx" ON "trip_lodging" USING btree ("trip_id","sort_order");--> statement-breakpoint
CREATE INDEX "trip_messages_trip_created_idx" ON "trip_messages" USING btree ("trip_id","created_at");--> statement-breakpoint
CREATE INDEX "trips_user_updated_idx" ON "trips" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "usage_events_user_created_idx" ON "usage_events" USING btree ("user_id","created_at");