const f = (name, label, type = 'text', required = false, options) => ({
  name,
  label,
  type,
  required,
  options,
})
export const modules = {
  seo_pages: {
    label: 'SEO Pages',
    fields: [
      f('path', 'Website path (for example /shop)', 'text', true),
      f('title', 'SEO title', 'text', true),
      f('description', 'Meta description', 'textarea'),
      f('image', 'Social sharing image URL'),
      f('noindex', 'Hide from search engines', 'boolean'),
      f('active', 'Published', 'boolean'),
    ],
  },
  products: {
    label: 'Products',
    fields: [
      f('name', 'Product name', 'text', true),
      f('slug', 'URL slug', 'text', true),
      f('category_id', 'Category', 'categories', true),
      f('description', 'Description', 'textarea'),
      f('about_item', 'About this item (one bullet per line)', 'textarea'),
      f('ingredients', 'Ingredients', 'textarea'),
      f('storage', 'Storage', 'textarea'),
      f('image', 'Primary image URL'),
      f('bestseller', 'Bestseller', 'boolean'),
      f('featured', 'Featured', 'boolean'),
      f('is_new', 'New arrival', 'boolean'),
      f('active', 'Published', 'boolean'),
    ],
  },
  category_groups: {
    label: 'Category Groups',
    fields: [
      f('name', 'Group name', 'text', true),
      f('slug', 'Slug', 'text', true),
      f('description', 'Description', 'textarea'),
      f('sort_order', 'Display order', 'number'),
      f('active', 'Published', 'boolean'),
    ],
  },
  categories: {
    label: 'Categories',
    fields: [
      f('name', 'Name', 'text', true),
      f('slug', 'Slug', 'text', true),
      f('group_id', 'Group name', 'category_groups', true),
      f('parent_id', 'Parent category (optional)', 'categories'),
      f('image', 'Image URL'),
      f('sort_order', 'Display order', 'number'),
      f('active', 'Published', 'boolean'),
    ],
  },
  variants: {
    label: 'Variants & Inventory',
    fields: [
      f('product_id', 'Product', 'products', true),
      f('weight', 'Pack size', 'text', true),
      f('price', 'Selling price', 'number', true),
      f('mrp', 'MRP', 'number', true),
      f('stock', 'Stock', 'number', true),
      f('weight_kg', 'Shipping weight (kg)', 'number', true),
      f('length_cm', 'Package length (cm)', 'number', true),
      f('breadth_cm', 'Package breadth (cm)', 'number', true),
      f('height_cm', 'Package height (cm)', 'number', true),
    ],
  },
  product_images: {
    label: 'Product Images',
    fields: [
      f('product_id', 'Product', 'products', true),
      f('image', 'Image URL', 'text', true),
      f('alt', 'Image description'),
      f('sort_order', 'Display order', 'number'),
    ],
  },
  customers: {
    label: 'Customers',
    fields: [
      f('name', 'Name', 'text', true),
      f('phone', 'Phone', 'text', true),
      f('email', 'Email', 'email'),
    ],
  },
  addresses: {
    label: 'Customer Addresses',
    fields: [
      f('customer_id', 'Customer', 'customers', true),
      f('address', 'Street address', 'textarea', true),
      f('landmark', 'Landmark'),
      f('city', 'City', 'text', true),
      f('state', 'State', 'text', true),
      f('pincode', 'PIN code', 'text', true),
    ],
  },
  orders: {
    label: 'Orders',
    fields: [
      f('status', 'Fulfilment status', 'select', true, [
        'Confirmed',
        'Packed',
        'Shipped',
        'Out for Delivery',
        'Delivered',
        'Cancelled',
      ]),
      f('payment_status', 'Payment status', 'select', true, ['Unpaid', 'Paid', 'Refunded']),
      f('tracking_number', 'Tracking number'),
      f('notes', 'Internal notes', 'textarea'),
    ],
  },
  coupons: {
    label: 'Coupons',
    fields: [
      f('code', 'Coupon code', 'text', true),
      f('type', 'Discount type', 'select', true, ['percent', 'fixed']),
      f('value', 'Discount value', 'number', true),
      f('min_cart', 'Minimum order', 'number'),
      f('label', 'Offer text', 'text', true),
      f('active', 'Enabled', 'boolean'),
    ],
  },
  banners: {
    label: 'Banners',
    fields: [
      f('title', 'Title', 'text', true),
      f('subtitle', 'Description', 'textarea'),
      f('image', 'Image URL'),
      f('link', 'Button link'),
      f('button_text', 'Button text'),
      f('placement', 'Placement', 'select', true, ['hero', 'seasonal', 'bottom', 'promotion']),
      f('sort_order', 'Display order', 'number'),
      f('active', 'Published', 'boolean'),
    ],
  },
  content_sections: {
    label: 'Homepage Sections',
    fields: [
      f('key', 'Section key', 'text', true),
      f('title', 'Title', 'text', true),
      f('subtitle', 'Eyebrow'),
      f('body', 'Body text', 'textarea'),
      f('image', 'Image URL'),
      f('link', 'Link'),
      f('button_text', 'Button text'),
      f('active', 'Published', 'boolean'),
    ],
  },
  pages: {
    label: 'Pages & Policies',
    fields: [
      f('slug', 'Page slug', 'text', true),
      f('title', 'Title', 'text', true),
      f('content', 'Content', 'textarea', true),
      f('active', 'Published', 'boolean'),
    ],
  },
  reviews: {
    label: 'Product Reviews',
    fields: [
      f('product_id', 'Product', 'products', true),
      f('customer_name', 'Customer name', 'text', true),
      f('rating', 'Rating 1–5', 'number', true),
      f('content', 'Review', 'textarea', true),
      f('approved', 'Approved', 'boolean'),
    ],
  },
  navigation: {
    label: 'Menu Management',
    fields: [
      f('label', 'Menu label', 'text', true),
      f('url', 'Destination URL', 'text', true),
      f('location', 'Menu location', 'select', true, ['header', 'footer']),
      f('parent_id', 'Parent menu ID (0 = top level)', 'number'),
      f('menu_type', 'Menu type', 'select', true, ['link', 'category', 'page', 'custom']),
      f('open_new_tab', 'Open in new tab', 'boolean'),
      f('sort_order', 'Display order', 'number'),
      f('active', 'Published', 'boolean'),
    ],
  },
  gift_boxes: {
    label: 'Customised Gift Boxes',
    fields: [
      f('name', 'Gift box name', 'text', true),
      f('slug', 'URL slug', 'text', true),
      f('description', 'Description', 'textarea'),
      f('about_item', 'About this gift box (one point per line)', 'textarea'),
      f('contents', 'Box contents / product information', 'textarea'),
      f('personalisation', 'Personalisation options', 'textarea'),
      f('image', 'Primary image URL', 'text', true),
      f('occasion', 'Occasion / label'),
      f('price', 'Selling price', 'number', true),
      f('mrp', 'MRP', 'number', true),
      f('stock', 'Stock', 'number', true),
      f('sku', 'SKU'),
      f('weight_kg', 'Shipping weight (kg)', 'number', true),
      f('length_cm', 'Package length (cm)', 'number', true),
      f('breadth_cm', 'Package breadth (cm)', 'number', true),
      f('height_cm', 'Package height (cm)', 'number', true),
      f('seo_title', 'SEO title'),
      f('seo_description', 'SEO description', 'textarea'),
      f('sort_order', 'Display order', 'number'),
      f('featured', 'Featured', 'boolean'),
      f('active', 'Published', 'boolean'),
    ],
  },
  settings: {
    label: 'Site Settings',
    fields: [
      f('key', 'Setting key', 'text', true),
      f('value', 'Value', 'textarea', true),
      f('description', 'Description'),
    ],
  },
  admins: {
    label: 'Administrators',
    fields: [
      f('name', 'Name', 'text', true),
      f('email', 'Login email', 'email', true),
      f('password', 'New password (blank keeps existing)', 'password'),
    ],
  },
}
export function validate(module, body, creating) {
  const result = {}
  for (const field of modules[module].fields) {
    let v = body[field.name]
    if (field.name === 'password' && !v) continue
    if (field.type === 'boolean') v = Boolean(v)
    else if (
      field.type === 'number' ||
      ['products', 'customers', 'categories', 'category_groups'].includes(field.type)
    ) {
      v = Number(v ?? 0)
      if (!Number.isFinite(v) || v < 0)
        throw new Error(`${field.label} must be a non-negative number.`)
    } else v = String(v ?? '').trim()
    const optionalSetting =
      module === 'settings' &&
      field.name === 'value' &&
      ['meta_pixel_id', 'seo_description', 'seo_title'].includes(body.key)
    if (field.required && !optionalSetting && (v === '' || v === null))
      throw new Error(`${field.label} is required.`)
    if (field.options && !field.options.includes(v)) throw new Error(`Invalid ${field.label}.`)
    if (String(v).length > 20000) throw new Error('Field is too long.')
    if (['image', 'link', 'url'].includes(field.name) && v && !/^(\/(?!\/)|https?:\/\/)/i.test(v))
      throw new Error('Use a relative path or http(s) URL.')
    result[field.name] = v
  }
  if (module === 'categories' && result.parent_id === 0) result.parent_id = null
  if (
    module === 'admins' &&
    ((creating && !result.password) || (result.password && result.password.length < 12))
  )
    throw new Error('Admin passwords need at least 12 characters.')
  if (
    ['products', 'categories', 'category_groups', 'pages', 'gift_boxes'].includes(module) &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug)
  )
    throw new Error('Use a lowercase, hyphenated slug.')
  if (
    module === 'variants' &&
    (result.price <= 0 || result.mrp < result.price || !Number.isInteger(result.stock))
  )
    throw new Error(
      'Price must be positive, MRP must be at least the price, and stock must be a whole number.',
    )
  if (
    module === 'reviews' &&
    (result.rating < 1 || result.rating > 5 || !Number.isInteger(result.rating))
  )
    throw new Error('Rating must be a whole number from 1 to 5.')
  if (
    module === 'coupons' &&
    (result.value <= 0 || (result.type === 'percent' && result.value > 100))
  )
    throw new Error('Enter a positive discount; percentages cannot exceed 100.')
  if (module === 'customers' && !/^[6-9]\d{9}$/.test(result.phone))
    throw new Error('Enter a valid 10-digit Indian mobile number.')
  if (module === 'addresses' && !/^\d{6}$/.test(result.pincode))
    throw new Error('Enter a valid six-digit PIN code.')
  if (module === 'admins' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    throw new Error('Enter a valid administrator email.')
  if (
    module === 'settings' &&
    ['free_shipping_threshold', 'shipping_fee'].includes(result.key) &&
    (!Number.isFinite(Number(result.value)) || Number(result.value) < 0)
  )
    throw new Error('Shipping amounts must be non-negative numbers.')
  if (module === 'seo_pages' && !/^\/(?!\/)[^?#\s]*$/.test(result.path))
    throw new Error('Enter a website path starting with /, without a query or fragment.')
  if (
    module === 'settings' &&
    result.key === 'meta_pixel_id' &&
    result.value &&
    !/^\d{5,30}$/.test(result.value)
  )
    throw new Error('Enter a numeric Meta Pixel ID, or leave it blank to disable tracking.')
  return result
}
