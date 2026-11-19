-- Where each product media file is stored: the STORAGE_<n>_* number and the object key in that
-- bucket. Both are NULL for external links and files in the site's public folder. Safe to re-run.
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS storage_number integer;
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS storage_key text;
CREATE INDEX IF NOT EXISTS product_media_storage_key_idx ON product_media (storage_key) WHERE storage_key IS NOT NULL;
