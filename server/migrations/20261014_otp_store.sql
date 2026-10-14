-- Phone OTP challenges and rate limits shared across serverless instances
CREATE TABLE IF NOT EXISTS customer_otp_challenges (token_hash text PRIMARY KEY, phone text NOT NULL, attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS auth_rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
