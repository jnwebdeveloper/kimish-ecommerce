import { readFile } from 'node:fs/promises'
import { loadEnv } from 'vite'
import { createPool } from './db.js'
import { passwordHash } from './password.js'
import { products, coupons } from '../src/data/products.js'
const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
if (!env.DATABASE_URL || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD)
  throw new Error('Set DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD in .env')
const pool = createPool(env),
  client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'))
  await client.query(
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS about_item text NOT NULL DEFAULT ''",
  )
  await client.query(
    "CREATE TABLE IF NOT EXISTS category_groups (id serial PRIMARY KEY, name text UNIQUE NOT NULL, slug text UNIQUE NOT NULL, description text NOT NULL DEFAULT '', sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true)",
  )
  await client.query(
    'ALTER TABLE categories ADD COLUMN IF NOT EXISTS group_id integer REFERENCES category_groups(id) ON DELETE RESTRICT',
  )
  await client.query(
    'ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id integer REFERENCES categories(id) ON DELETE RESTRICT',
  )
  const defaultGroups = [
    'Nuts',
    'Seeds',
    'Dried Fruits',
    'Everyday Favourite',
    'Roasted Items',
    'Customised Gifts',
  ]
  for (const [i, name] of defaultGroups.entries()) {
    const slug = name
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    await client.query(
      'INSERT INTO category_groups(name,slug,sort_order) VALUES($1,$2,$3) ON CONFLICT(name) DO NOTHING',
      [name, slug, i],
    )
  }
  await client.query(
    'UPDATE categories c SET group_id=g.id FROM category_groups g WHERE c.group_name=g.name AND c.group_id IS NULL',
  )
  await client.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_check')
  await client.query(
    "ALTER TABLE orders ADD CONSTRAINT orders_payment_check CHECK(payment IN ('cod','razorpay'))",
  )
  await client.query(
    'ALTER TABLE variants ADD COLUMN IF NOT EXISTS weight_kg numeric(8,3) NOT NULL DEFAULT 0.5, ADD COLUMN IF NOT EXISTS length_cm numeric(8,2) NOT NULL DEFAULT 20, ADD COLUMN IF NOT EXISTS breadth_cm numeric(8,2) NOT NULL DEFAULT 20, ADD COLUMN IF NOT EXISTS height_cm numeric(8,2) NOT NULL DEFAULT 10',
  )
  const first = !(await client.query('SELECT 1 FROM admins LIMIT 1')).rowCount
  if (first)
    await client.query('INSERT INTO admins(email,password_hash) VALUES($1,$2)', [
      env.ADMIN_EMAIL,
      passwordHash(env.ADMIN_PASSWORD),
    ])
  if (!(await client.query('SELECT 1 FROM categories LIMIT 1')).rowCount) {
    for (const [index, p] of products.entries()) {
      const group = ['Cashew', 'Almonds', 'Walnut', 'Pista'].includes(p.category)
        ? 'Nuts'
        : ['Raisins', 'Cranberries'].includes(p.category)
          ? 'Dried Fruits'
          : p.category === 'Seeds'
            ? 'Seeds'
            : 'Everyday Favourite'
      const groupId = (await client.query('SELECT id FROM category_groups WHERE name=$1', [group]))
        .rows[0]?.id
      const cat = await client.query(
        'INSERT INTO categories(name,slug,group_name,group_id,image,sort_order) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(name) DO UPDATE SET group_name=EXCLUDED.group_name,group_id=EXCLUDED.group_id RETURNING id',
        [p.category, p.category.toLowerCase(), group, groupId, p.images[0], index],
      )
      const prod = await client.query(
        'INSERT INTO products(name,slug,category_id,description,ingredients,storage,image,bestseller,featured,is_new) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
        [
          p.name,
          p.slug,
          cat.rows[0].id,
          p.description,
          p.ingredients,
          p.storage,
          p.images[0],
          p.bestseller,
          p.featured,
          p.isNew,
        ],
      )
      for (const v of p.variants)
        await client.query(
          'INSERT INTO variants(product_id,weight,price,mrp,stock) VALUES($1,$2,$3,$4,$5)',
          [prod.rows[0].id, v.weight, v.price, v.mrp, v.stock],
        )
    }
    for (const [code, c] of Object.entries(coupons))
      await client.query(
        'INSERT INTO coupons(code,type,value,min_cart,label) VALUES($1,$2,$3,$4,$5)',
        [code, c.type, c.value, c.minCart, c.label],
      )
  }

  const defaultAbout = `PREMIUM QUALITY MAKHANA: KIMISH Makhana is carefully selected to offer quality fox nuts with a light, crunchy texture, making them a versatile addition to your pantry.
JUMBO & HAND PICKED: Selected for their size and quality, these jumbo makhanas are hand picked to provide a consistent snacking and cooking experience.
PERFECT FOR EVERYDAY SNACKING: Roast with your favourite seasonings for a quick crunchy snack. Enjoy at home, at work, while travelling or whenever cravings strike.
IDEAL FOR FASTING & INDIAN RECIPES: A versatile ingredient suitable for vrat/fasting preparations as well as makhana kheer, curries, raita, namkeen and other traditional recipes.
MULTIPLE WAYS TO ENJOY: Roast, season, cook or add to desserts. KIMISH Makhana works equally well as a simple snack or as an ingredient in sweet and savoury dishes.`
  await client.query("UPDATE products SET about_item=$1 WHERE about_item=''", [defaultAbout])
  if (!(await client.query('SELECT 1 FROM gift_boxes LIMIT 1')).rowCount) {
    const gifts = [
      [
        'Heritage Pink Gift Box',
        'heritage-pink-gift-box',
        'A timeless presentation for celebrations and thoughtful gifting.',
        '/gifts/custom-gift-pink-closed.jpeg',
        'Weddings & celebrations',
        1,
      ],
      [
        'Curated Four Jar Gift Box',
        'curated-four-jar-gift-box',
        'Four premium jars presented in a beautifully curated keepsake box.',
        '/gifts/custom-gift-pink-open.jpeg',
        'Festive & corporate gifting',
        2,
      ],
      [
        'Royal Blue Gift Box',
        'royal-blue-gift-box',
        'An elegant statement gift crafted for memorable occasions.',
        '/gifts/custom-gift-blue.jpeg',
        'Special occasions',
        3,
      ],
    ]
    for (const g of gifts)
      await client.query(
        'INSERT INTO gift_boxes(name,slug,description,image,occasion,sort_order) VALUES($1,$2,$3,$4,$5,$6)',
        g,
      )
  }
  const settings = {
    brand_name: 'Kimish',
    meta_pixel_id: '',
    site_url: 'http://localhost:5173',
    free_shipping_threshold: '499',
    shipping_fee: '79',
    support_phone: '919999999999',
    support_email: '',
    instagram: '@kimishfoods',
    support_hours: 'Mon–Sat, 10 AM–6 PM',
    footer_description:
      'Premium nuts, dry fruits and seeds packed for freshness and everyday goodness.',
  }
  for (const [key, value] of Object.entries(settings))
    await client.query(
      'INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING',
      [key, value],
    )
  const sections = [
    [
      'hero',
      'Good food starts with better ingredients.',
      'PREMIUM NUTS • DRY FRUITS • SEEDS',
      'Carefully selected premium nuts, seeds and dried fruits, packed with care for everyday snacking, thoughtful gifting and better pantry moments.',
      'Shop collection',
    ],
    [
      'everyday',
      'Small choices. Better days.',
      'EVERYDAY GOODNESS',
      'From breakfast bowls to the 4 PM snack break, Kimish brings premium ingredients into the moments that make up your day.',
      'Explore wholesome snacks',
    ],
    [
      'story',
      'Good ingredients. Handled thoughtfully.',
      'THE KIMISH WAY',
      'Behind every pack is a simple idea: choose well, pack carefully and make premium snacking easy to enjoy every day.',
      'Discover our range',
    ],
    [
      'promise',
      'Premium is a promise, not just a label.',
      'THE DETAILS MAKE THE DIFFERENCE',
      'Good ingredients deserve care at every step. Here’s what goes into every Kimish pack.',
      'Find your everyday favourites',
    ],
  ]
  for (const s of sections)
    await client.query(
      'INSERT INTO content_sections(key,title,subtitle,body,button_text) VALUES($1,$2,$3,$4,$5) ON CONFLICT(key) DO NOTHING',
      s,
    )
  const cards = [
    [
      'story-ingredients',
      'Handpicked Ingredients',
      'We source with a focus on taste, texture and dependable quality.',
      '/products/kimish-mamra-almond.png',
    ],
    [
      'story-care',
      'Packed with Care',
      'Freshness-focused packing protects the flavour and crunch you expect.',
      '/brand-banners/quality.png',
    ],
    [
      'story-moments',
      'Made for Every Moment',
      'From breakfast bowls to festive gifting, there is a Kimish pick for it.',
      '/brand-banners/ingredients.png',
    ],
    [
      'promise-selection',
      'Selected with intention',
      'Wholesome ingredients, chosen for their taste, texture and everyday goodness.',
      '',
    ],
    [
      'promise-quality',
      'Quality in every detail',
      'A considered approach to the quality you see, taste and enjoy.',
      '',
    ],
    [
      'promise-care',
      'Care in every pack',
      'Thoughtful packing to protect the freshness, flavour and crunch inside.',
      '',
    ],
    [
      'promise-delivery',
      'From our shelf to yours',
      'Delivered across India, ready for your pantry or a thoughtful gift.',
      '',
    ],
  ]
  for (const card of cards)
    await client.query(
      'INSERT INTO content_sections(key,title,body,image) VALUES($1,$2,$3,$4) ON CONFLICT(key) DO NOTHING',
      card,
    )
  if (!(await client.query('SELECT 1 FROM banners LIMIT 1')).rowCount) {
    await client.query(
      "INSERT INTO banners(title,subtitle,image,placement,button_text) VALUES ('Handpicked for the season.','Discover festive-ready favourites and wholesome pantry staples selected for the moments worth sharing.','/products/kimish-cranberries.png','seasonal','Explore seasonal'),('Good Food Begins with Good Ingredients.','','/brand-banners/ingredients.png','bottom','Discover Kimish')",
    )
  }
  await client.query(
    "INSERT INTO pages(slug,title,content) VALUES ('policy','Shipping & No Returns Policy','Shipping across India is subject to courier serviceability.\n\nDue to the nature of food products, returns are not accepted. Contact support about damaged, missing or incorrect items.') ON CONFLICT(slug) DO NOTHING",
  )
  await client.query('COMMIT')
  console.log(
    'PostgreSQL schema and seed data ready. Admin credentials are in ADMIN_CREDENTIALS.local.md.',
  )
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
