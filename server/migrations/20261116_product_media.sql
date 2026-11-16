-- Product media: product_images becomes product_media (images, videos and other files),
-- and the products' main image column becomes media_url. Safe to re-run.
DO $$
BEGIN
  -- db:setup may already have created an empty product_media next to the old table
  IF to_regclass('public.product_images') IS NOT NULL AND to_regclass('public.product_media') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM product_media) THEN
      DROP TABLE product_media;
    ELSE
      RAISE EXCEPTION 'Both product_images and product_media contain rows; merge them by hand before migrating.';
    END IF;
  END IF;

  IF to_regclass('public.product_images') IS NOT NULL THEN
    ALTER TABLE product_images RENAME TO product_media;
  END IF;
  IF to_regclass('public.product_images_id_seq') IS NOT NULL THEN
    ALTER SEQUENCE product_images_id_seq RENAME TO product_media_id_seq;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_images_pkey') THEN
    ALTER TABLE product_media RENAME CONSTRAINT product_images_pkey TO product_media_pkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_images_product_id_fkey') THEN
    ALTER TABLE product_media RENAME CONSTRAINT product_images_product_id_fkey TO product_media_product_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'product_media' AND column_name = 'image') THEN
    ALTER TABLE product_media RENAME COLUMN image TO media_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'product_media' AND column_name = 'alt') THEN
    ALTER TABLE product_media RENAME COLUMN alt TO alt_text;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image') THEN
    ALTER TABLE products RENAME COLUMN image TO media_url;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS product_media (id serial PRIMARY KEY, product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE, media_url text NOT NULL, alt_text text NOT NULL DEFAULT '', sort_order integer NOT NULL DEFAULT 0, media_type text NOT NULL DEFAULT 'image');
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';
ALTER TABLE product_media DROP CONSTRAINT IF EXISTS product_media_media_type_check;
ALTER TABLE product_media ADD CONSTRAINT product_media_media_type_check CHECK (media_type IN ('image', 'video', 'other'));
CREATE INDEX IF NOT EXISTS product_media_product_idx ON product_media (product_id, sort_order, id);
