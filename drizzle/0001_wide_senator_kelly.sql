ALTER TABLE "workspace_sources" DROP CONSTRAINT "workspace_sources_source_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_sources" ADD CONSTRAINT "workspace_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;