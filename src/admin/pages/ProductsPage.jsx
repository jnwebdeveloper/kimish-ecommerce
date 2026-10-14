import { categoryPath } from '../../data/categoryHierarchy'
import GalleryManager from '../components/GalleryManager'
import ProductCategoryFields from '../components/ProductCategoryFields'
import ModulePage from './ModulePage'

// Price and stock come from the product's variants
const variantsOf = (references, row) =>
  (references.variants || []).filter((v) => String(v.product_id) === String(row.id))

export default function ProductsPage() {
  return (
    <ModulePage
      module="products"
      help="Manage product information and photos here. Set pack sizes, prices and stock in Variants & Inventory."
      formatters={(references) => ({
        category_id: (row) =>
          categoryPath(references.categories || [], row.category_id)
            .map((c) => c.name)
            .join(' › ') || '—',
        price_range: (row) => {
          const variants = variantsOf(references, row)
          return variants.length
            ? '₹' +
                Math.min(...variants.map((v) => Number(v.price))).toLocaleString('en-IN') +
                ' onwards'
            : 'No variants'
        },
        inventory: (row) => {
          const variants = variantsOf(references, row)
          return variants.length
            ? variants.reduce((sum, v) => sum + Number(v.stock), 0) + ' in stock'
            : 'No variants'
        },
      })}
      fieldOverrides={(references) => ({
        // Group → category → subcategory pickers instead of one long category list
        category_id: (record, set) => (
          <ProductCategoryFields
            categories={references.categories}
            groups={references.category_groups}
            value={record.category_id}
            onChange={(value) => set('category_id', value)}
          />
        ),
      })}
      validate={(record) =>
        !record.category_id ? 'Choose a category before saving the product.' : ''
      }
      renderEditorExtras={({ record, references, reload, ...editor }) => (
        <GalleryManager
          productId={record.id}
          images={references.product_images}
          reload={reload}
          {...editor}
        />
      )}
    />
  )
}
