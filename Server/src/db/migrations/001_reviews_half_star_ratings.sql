BEGIN;

ALTER TABLE "reviews"
  ALTER COLUMN "rating" TYPE numeric(2, 1) USING "rating"::numeric(2, 1);

ALTER TABLE "reviews"
  ADD CONSTRAINT "rating_half_star_increment" CHECK (mod("rating", 0.5) = 0);

COMMIT;
