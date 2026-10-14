import { useState } from 'react'
import { apiRequest } from '../../data/StoreContext'
import Messages from './Messages'
import Modal from './Modal'

const blankOrder = () => ({
  customer: {
    name: '',
    mobile: '',
    email: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
  },
  items: [{ variantId: '', qty: 1 }],
  payment: 'cod',
})

// Manual (Cash on Delivery) order; the server prices it and updates stock
export default function CreateOrderDialog({ references, onClose, onCreated }) {
  const [order, setOrder] = useState(blankOrder),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const setItem = (index, changes) =>
    setOrder({
      ...order,
      items: order.items.map((item, n) => (n === index ? { ...item, ...changes } : item)),
    })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiRequest('/api/admin/create/order', order)
      onCreated('Order saved and stock updated.')
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} busy={busy} aria-label="Create order">
      <h2>Create order</h2>
      <form onSubmit={submit}>
        <div className="admin-form-grid">
          {Object.keys(order.customer).map((key) => (
            <label key={key}>
              {key}
              <input
                required={!['email', 'landmark'].includes(key)}
                value={order.customer[key]}
                onChange={(e) =>
                  setOrder({ ...order, customer: { ...order.customer, [key]: e.target.value } })
                }
              />
            </label>
          ))}
        </div>
        <h3>Order items</h3>
        {order.items.map((item, index) => (
          <div className="admin-toolbar" key={index}>
            <select
              aria-label={`Variant ${index + 1}`}
              required
              value={item.variantId}
              onChange={(e) => setItem(index, { variantId: e.target.value })}
            >
              <option value="">Select product / pack</option>
              {references.variants?.map((v) => (
                <option key={v.id} value={v.id}>
                  {references.products?.find((p) => p.id === v.product_id)?.name} · {v.weight} · ₹
                  {v.price} · Stock {v.stock}
                </option>
              ))}
            </select>
            <input
              aria-label={`Quantity ${index + 1}`}
              type="number"
              min="1"
              max="100"
              value={item.qty}
              onChange={(e) => setItem(index, { qty: Number(e.target.value) })}
            />
            <button
              type="button"
              disabled={order.items.length === 1}
              onClick={() =>
                setOrder({ ...order, items: order.items.filter((_, n) => n !== index) })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setOrder({ ...order, items: [...order.items, { variantId: '', qty: 1 }] })}
        >
          Add item
        </button>
        <p>
          Prices, shipping and stock are calculated by the server. New orders use Cash on Delivery.
        </p>
        <Messages error={error} />
        <button disabled={busy} className="btn btn-primary">
          Create order
        </button>{' '}
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
      </form>
    </Modal>
  )
}
