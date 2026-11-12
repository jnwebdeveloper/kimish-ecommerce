ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications text NOT NULL DEFAULT '[]';
