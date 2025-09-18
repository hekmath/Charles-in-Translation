CREATE TYPE "public"."chunk_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "translation_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"chunk_index" integer NOT NULL,
	"status" "chunk_status" DEFAULT 'pending' NOT NULL,
	"items_count" integer DEFAULT 0 NOT NULL,
	"translated_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "translation_tasks" ADD COLUMN "total_keys" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "translation_tasks" ADD COLUMN "translated_keys" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "translation_tasks" ADD COLUMN "failed_chunks" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "translation_tasks" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "translation_tasks" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "translations" ADD COLUMN "task_id" integer;--> statement-breakpoint
ALTER TABLE "translations" ADD COLUMN "chunk_index" integer;--> statement-breakpoint
ALTER TABLE "translations" ADD COLUMN "failed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "translation_chunks" ADD CONSTRAINT "translation_chunks_task_id_translation_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."translation_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translations" ADD CONSTRAINT "translations_task_id_translation_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."translation_tasks"("id") ON DELETE no action ON UPDATE no action;