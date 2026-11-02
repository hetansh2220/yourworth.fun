BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code varchar(6);
ALTER TABLE users ALTER COLUMN referral_code SET DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
UPDATE users SET referral_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 6) WHERE referral_code IS NULL;
ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique ON users (referral_code);

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referred_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_user_unique ON referrals (referred_user_id);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id);
ALTER TABLE referrals DROP COLUMN IF EXISTS referral_code;

COMMIT;
