ALTER TABLE "dm_requests" ALTER COLUMN "request_id" TYPE numeric(78, 0) USING "request_id"::numeric(78, 0);
