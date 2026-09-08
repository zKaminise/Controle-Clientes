DROP INDEX "companies_owner_name_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "companies_owner_name_city_uq" ON "companies" USING btree ("owner_user_id","name","city");