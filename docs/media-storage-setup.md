# Media storage setup (Cloudflare R2)

The admin uploads product photos and videos straight from the browser to a Cloudflare R2 bucket.
Files never pass through the API, so the 4.5 MB Vercel request limit doesn't apply.

| Kind   | Formats        | Largest file |
| ------ | -------------- | ------------ |
| Images | JPG, PNG, WebP | 8 MB         |
| Videos | MP4, WebM      | 50 MB        |

## How an upload works

1. The admin picks a file. The admin page asks `POST /api/admin/media/sign` for an upload link.
   The link works for 10 minutes and only for that file's exact type and size.
2. The browser `PUT`s the file to R2 using that link.
3. The admin page calls `POST /api/admin/media/confirm`. The API reads the first bytes of the stored
   file to make sure it really is an image or video and within the size limit. If it isn't, the file
   is deleted and the admin sees an error.
4. The admin clicks **Save changes**. The product and its gallery are saved in one database
   transaction.

Files are named `<folder>/<record id>-<random id>.<ext>`, for example
`products/12-3f0c….webp`. A product that hasn't been saved yet has no ID, so its files are first
named `products/new-<random id>.<ext>`. When the product is saved they are copied to the
`<id>-` name and the `new-` copies are deleted.

### When files are deleted

Each `product_media` row records where its file lives: `storage_number` (the `STORAGE_<n>` it was
uploaded to) and `storage_key` (its name in that bucket). Both are empty for external links and
files in the site's `public/` folder, which are never deleted.

| What happens                                           | What is deleted from the bucket                               |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| You remove a file you uploaded in this editing session | The file, straight away                                       |
| You close the editor without saving                    | Every file uploaded in that session that wasn't saved         |
| You remove a saved file and click **Save changes**     | The file, after the save, unless another record still uses it |
| You delete a product                                   | Its files, unless another record still uses them              |
| You remove an external link or a `/products/...` file  | Nothing; it is only taken off the product                     |

"Another record" means another product, a category, a banner, a homepage section, a gift box or an
SEO page. Orders don't store image URLs, so old orders are never affected. Deleted files can't be
recovered, because R2 has no recycle bin. If a delete fails, it is logged and the file stays.

If the browser closes before an editor is closed, its unsaved uploads stay in the bucket. To clean
those up automatically, add an R2 lifecycle rule (**Settings → Object lifecycle rules**) that deletes
objects with the prefix `products/new-` after 7 days.

## 1. Create the buckets

Use two buckets so local testing never touches live files:

- `kimish-media` for the live site
- `kimish-media-dev` for local development

In the Cloudflare dashboard go to **R2 Object Storage → Create bucket**, enter the name and keep the
default location. Repeat for the dev bucket.

## 2. Make the files public

Product photos must load for every visitor, so each bucket needs a public URL.

**Recommended: a custom domain.** In the bucket go to **Settings → Public access → Custom Domains →
Connect Domain** and enter a subdomain of a domain that is on Cloudflare, for example
`media.yourdomain.com`. Saved URLs then use your domain, so you can switch buckets later without
changing the database.

**For the dev bucket:** **Settings → Public access → R2.dev subdomain → Allow Access** is enough. It
gives you a URL like `https://pub-xxxxxxxx.r2.dev`. Cloudflare rate-limits r2.dev URLs, so don't use
them for the live site.

Optional, for faster repeat visits: uploaded files never change (every upload gets a new name), so
on the custom domain you can add a Cloudflare Cache Rule with a long browser cache time (for
example one year).

## 3. Create an API token

Go to **R2 Object Storage → Manage R2 API Tokens → Create API Token**:

- **Permissions:** Object Read & Write
- **Specify bucket(s):** apply to the one bucket this token is for. Make a separate token for the
  dev bucket.
- **TTL:** forever, or your rotation period

After creating it, copy the **Access Key ID** and **Secret Access Key**. The secret is shown only
once. Your **Account ID** is on the R2 overview page.

Never put these values in front-end code, commit them, or paste them into chats. They belong only
in `.env` (locally) and in Vercel's environment variables.

## 4. Set the environment variables

Locally in `.env` (dev bucket):

```
STORAGE_ACTIVE=1
STORAGE_1_TYPE=r2
STORAGE_1_NAME=Cloudflare R2 (dev)
STORAGE_1_ACCOUNT_ID=<account id>
STORAGE_1_BUCKET=kimish-media-dev
STORAGE_1_KEY_ID=<dev access key id>
STORAGE_1_SECRET=<dev secret access key>
STORAGE_1_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
```

On Vercel (**Project → Settings → Environment Variables**, Production), add the same names with the
live bucket, its token and `https://media.yourdomain.com`. Then redeploy.

Rules:

- `STORAGE_<n>_PUBLIC_URL` must start with `https://` and must not end with `/`.
- If any variable in a block is missing, the API refuses to start and the error names it.
- Remove any old `STORAGE_<n>_TYPE=vercel-blob` block, or make the R2 block the active one. Vercel
  Blob can't take direct uploads, so uploads stay off while it is active.

## 5. Add the CORS rule

The browser uploads to a different domain (R2), so each bucket must allow it. In the bucket go to
**Settings → CORS Policy → Add CORS policy** and paste the JSON.

Live bucket (use your real site address, with no trailing slash):

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

If the site also answers on `https://www.yourdomain.com`, add that to `AllowedOrigins` too.

Dev bucket (the Vite dev server runs on port 5173):

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

If the CORS rule is missing or wrong, the admin shows "The upload could not reach storage", and the
browser console shows a CORS error for the `PUT` request.

## 6. Update the database

For a database that already has `product_media`, add the storage columns:

```sql
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS storage_number integer;
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS storage_key text;
```

Existing rows keep these empty; files from your buckets are still found by their URL when deleted.

The gallery table is now `product_media` (columns `media_url`, `alt_text`, `sort_order` and
`media_type`, which is `image`, `video` or `other`). The products' main image column is now
`products.media_url`. Run the migration on every database before deploying this code:

```
npm run db:migrate
```

For production, run only the new file against the production database:

```
psql "$PROD_DATABASE_URL" -f server/migrations/20261116_product_media.sql
```

The migration renames `product_images` → `product_media`, `image` → `media_url`, `alt` →
`alt_text` and `products.image` → `products.media_url`, then adds `media_type`. Existing rows and
URLs are kept, and it is safe to run more than once.

## 7. Check it works

1. Start the app (`npm run dev`) and sign in to the admin.
2. Add a product, upload a main image and a video in the gallery, and click **Save changes**.
3. In the R2 bucket, the files should be under `products/<product id>-…`, with no `new-…` files
   left behind.
4. Open the product in the shop. The video should play in the gallery.
