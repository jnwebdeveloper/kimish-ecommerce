CREATE TABLE IF NOT EXISTS admin_password_resets (id BIGSERIAL PRIMARY KEY,admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS admin_password_resets_admin_idx ON admin_password_resets(admin_id);
CREATE INDEX IF NOT EXISTS admin_password_resets_expiry_idx ON admin_password_resets(expires_at);
ALTER TABLE variants ADD CONSTRAINT variants_stock_nonnegative CHECK (stock >= 0);
