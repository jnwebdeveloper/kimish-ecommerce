// Ownership comes exclusively from the verified session, never from request input.
export async function customerOrders(pool, tokenHash, orderNumber) {
  const session = (
    await pool.query(
      'SELECT customer_id FROM customer_sessions WHERE token_hash=$1 AND expires_at>now()',
      [tokenHash],
    )
  ).rows[0]
  if (!session) return { status: 401, body: { message: 'Please sign in to view your orders.' } }
  const fields =
    'order_number,status,payment,payment_status,subtotal,discount,shipping,total,created_at,tracking_number'
  if (orderNumber) {
    const order = (
      await pool.query(
        `SELECT id,${fields},customer_snapshot FROM orders WHERE customer_id=$1 AND order_number=$2`,
        [session.customer_id, orderNumber],
      )
    ).rows[0]
    if (!order) return { status: 404, body: { message: 'Order not found.' } }
    const items = (
      await pool.query(
        'SELECT id,product_name,weight,price,quantity FROM order_items WHERE order_id=$1 ORDER BY id',
        [order.id],
      )
    ).rows
    const details = { ...order }
    delete details.id
    return { status: 200, body: { ...details, items } }
  }
  const orders = (
    await pool.query(
      `SELECT ${fields} FROM orders WHERE customer_id=$1 ORDER BY created_at DESC,id DESC`,
      [session.customer_id],
    )
  ).rows
  return { status: 200, body: { orders } }
}
