import { AppError } from "../errors.js";

/**
 * Lock product rows in a stable id order to avoid deadlocks when two
 * checkouts reserve overlapping SKUs at the same time.
 */
export async function lockProducts(client, productIds) {
  const unique = [...new Set(productIds)].sort();
  if (unique.length === 0) return [];
  const result = await client.query(
    `SELECT * FROM products
     WHERE id = ANY($1::uuid[])
     ORDER BY id
     FOR UPDATE`,
    [unique]
  );
  return result.rows;
}

export async function restoreStockForOrder(client, orderId) {
  const items = await client.query(
    `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
    [orderId]
  );
  const productIds = items.rows.map((row) => row.product_id);
  await lockProducts(client, productIds);

  for (const item of items.rows) {
    await client.query(
      `UPDATE products
       SET stock = stock + $2, updated_at = NOW()
       WHERE id = $1`,
      [item.product_id, item.quantity]
    );
  }
}

/**
 * Compare-and-swap: only the transaction that still sees status=reserved
 * may release stock. Prevents double-restore if the expiry worker and a
 * payment failure/timeout race each other.
 */
export async function releaseReservation(client, orderId, nextStatus, reason) {
  const updated = await client.query(
    `UPDATE orders
     SET status = $2,
         payment_in_progress = FALSE,
         reservation_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $1 AND status = 'reserved'
     RETURNING *`,
    [orderId, nextStatus]
  );

  if (updated.rowCount === 0) {
    return null;
  }

  await restoreStockForOrder(client, orderId);
  await client.query(
    `INSERT INTO order_status_events (order_id, from_status, to_status, reason)
     VALUES ($1, 'reserved', $2, $3)`,
    [orderId, nextStatus, reason]
  );
  return updated.rows[0];
}

export async function expireOrderIfDue(client, orderId) {
  const result = await client.query(
    `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId]
  );
  if (result.rowCount === 0) {
    throw new AppError(404, "NOT_FOUND", "Order not found", { id: orderId });
  }
  const order = result.rows[0];
  if (
    order.status === "reserved" &&
    order.reservation_expires_at &&
    new Date(order.reservation_expires_at) <= new Date()
  ) {
    const expired = await releaseReservation(
      client,
      order.id,
      "expired",
      "Reservation auto-expired after 5 minutes"
    );
    return expired || (await client.query(`SELECT * FROM orders WHERE id = $1`, [orderId])).rows[0];
  }
  return order;
}
