// Sidebar groups: [module key, label]. Module keys match the API (/api/admin/<key>).
export const menu = [
  { label: 'Dashboard', items: [['overview', 'Overview']] },
  {
    label: 'Catalogue',
    items: [
      ['products', 'Products'],
      ['category_groups', 'Category Groups'],
      ['categories', 'Categories'],
      ['variants', 'Variants & Inventory'],
      ['gift_boxes', 'Customised Gift Boxes'],
    ],
  },
  {
    label: 'Sales & Fulfilment',
    items: [
      ['orders', 'Orders'],
      ['customers', 'Customers'],
      ['addresses', 'Customer Addresses'],
      ['coupons', 'Coupons'],
    ],
  },
  {
    label: 'Website & Content',
    items: [
      ['banners', 'Banners'],
      ['content_sections', 'Homepage Sections'],
      ['pages', 'Pages & Policies'],
      ['navigation', 'Menu Management'],
      ['reviews', 'Product Reviews'],
    ],
  },
  {
    label: 'System',
    items: [
      ['settings', 'Site Settings'],
      ['admins', 'Administrators'],
      ['audit', 'Activity Log'],
    ],
  },
]

const menuLabels = Object.fromEntries(menu.flatMap((group) => group.items))
export const isMenuModule = (key) => key in menuLabels
export const menuLabel = (key) => menuLabels[key]

// Module keys use underscores (gift_boxes); their addresses use hyphens (/admin/gift-boxes). Overview is /admin itself.
export const pathFor = (key) =>
  key === 'overview' ? '/admin' : '/admin/' + key.replaceAll('_', '-')
export const moduleFromSlug = (slug) => slug.replaceAll('-', '_')

// Only return to another admin address after sign-in, never an outside URL
export const safeNext = (next) =>
  next && /^\/admin(\/|\?|$)/.test(next) && !/^\/admin\/login(\/|\?|$)/.test(next) ? next : '/admin'

// Other lists each screen needs for dropdowns, names, price/stock columns, galleries and the manual order form
export const referencesFor = {
  products: ['categories', 'category_groups', 'variants', 'product_images'],
  categories: ['categories', 'category_groups'],
  variants: ['products'],
  product_images: ['products'],
  reviews: ['products'],
  addresses: ['customers'],
  orders: ['customers', 'products', 'variants'],
}
export const referenceKeys = new Set(Object.values(referencesFor).flat())

// Options for screens that use the generic page
export const moduleOptions = {
  navigation: {
    help: 'Manage additional header and footer links: choose the label, destination, display order and whether to open in a new tab. Collection menus are managed through Categories.',
    hiddenFields: ['parent_id', 'menu_type'],
  },
  admins: {
    help: 'Manage staff accounts that can sign in to the back office and edit store data. Only the primary administrator can manage these accounts and view the activity log. These are not customer accounts.',
  },
  gift_boxes: { help: 'Manage gift box contents, pricing, inventory and shipping information.' },
  audit: { readOnly: true, title: 'Activity log' },
}
