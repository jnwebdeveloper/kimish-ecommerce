import CreateOrderDialog from '../components/CreateOrderDialog'
import ModulePage from './ModulePage'

export default function OrdersPage() {
  return (
    <ModulePage
      module="orders"
      // Orders keep a snapshot of the delivery details, so show the name used at checkout
      formatters={(references) => ({
        customer_id: (row) =>
          row.customer_snapshot?.name ||
          references.customers?.find((r) => r.id === row.customer_id)?.name ||
          '—',
      })}
      // "Add order" opens the manual order form; Edit still changes status, payment and tracking
      AddDialog={CreateOrderDialog}
    />
  )
}
