// Everything the storefront needs in one payload: published products (with variants and photos),
// categories, coupons, banners, pages, menus, homepage sections, gift boxes, reviews and public settings
export async function storeCatalog(pool) {
  const products = (
    await pool.query(
      'SELECT p.*,c.name category,coalesce((SELECT avg(r.rating) FROM reviews r WHERE r.product_id=p.id AND r.approved),0) rating,(SELECT count(*) FROM reviews r WHERE r.product_id=p.id AND r.approved) reviews FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active AND c.active ORDER BY p.id',
    )
  ).rows
  const variants = (await pool.query('SELECT * FROM variants ORDER BY price,id')).rows
  const images = (await pool.query('SELECT * FROM product_images ORDER BY sort_order,id')).rows
  const result = {
    products: products
      .map((p) => ({
        ...p,
        isNew: p.is_new,
        rating: Number(p.rating).toFixed(1),
        reviews: Number(p.reviews),
        images: [
          p.image,
          ...images.filter((i) => i.product_id === p.id).map((i) => i.image),
        ].filter(Boolean),
        variants: variants
          .filter((v) => v.product_id === p.id)
          .map((v) => ({ ...v, price: Number(v.price), mrp: Number(v.mrp) })),
      }))
      // Products without a variant can't be bought, so they stay hidden
      .filter((p) => p.variants.length),
  }
  result.categories = (
    await pool.query(
      'SELECT c.*,coalesce(g.name,c.group_name) group_name FROM categories c LEFT JOIN category_groups g ON g.id=c.group_id WHERE c.active=true ORDER BY c.id',
    )
  ).rows
  for (const m of [
    'coupons',
    'banners',
    'pages',
    'navigation',
    'content_sections',
    'gift_boxes',
    'seo_pages',
  ])
    result[m] = (await pool.query(`SELECT * FROM ${m} WHERE active=true ORDER BY id`)).rows
  result.reviews = (
    await pool.query(
      'SELECT id,product_id,customer_name,rating,content FROM reviews WHERE approved=true ORDER BY id DESC',
    )
  ).rows
  // Shiprocket settings are internal (pickup address details)
  result.settings = Object.fromEntries(
    (
      await pool.query("SELECT key,value FROM settings WHERE key NOT LIKE 'shiprocket\\_%'")
    ).rows.map((r) => [r.key, r.value]),
  )
  return result
}
