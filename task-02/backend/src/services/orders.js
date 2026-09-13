import { pool, withTransaction } from "../db/pool.js";
import { expireOrderIfDue, releaseReservation } from "./inventory.js";
import { mapOrder } from "./status.js";

async function loadItems(orderId) {
  const result = await pool.query(
    `SELECT product_id, product_name, unit_price, quantity
     FROM order_items
     WHERE order_id = $1
     ORDER BY product_name`,
    [orderId]
  );
  return result.rows.map((row) => ({
    productId: row.product_id,
    name: row.product_name,
    unitPrice: Number(row.unit_price),
    quantity: row.quantity,
    lineTotal: Number(row.unit_price) * row.quantity,
  }));
}

async function loadHistory(orderId) {
  const result = await pool.query(
    `SELECT from_status, to_status, reason, created_at
     FROM order_status_events
     WHERE order_id = $1
     ORDER BY created_at ASC`,
    [orderId]
  );
  return result.rows.map((row) => ({
    from: row.from_status,
    to: row.to_status,
    reason: row.reason,
    at: row.created_at,
  }));
}

async function loadPayments(orderId) {
  const result = await pool.query(
    `SELECT id, outcome, status, created_at
     FROM payments
     WHERE order_id = $1
     ORDER BY created_at ASC`,
    [orderId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    outcome: row.outcome,
    status: row.status,
    createdAt: row.created_at,
  }));
}

async function loadRefunds(orderId) {
  const result = await pool.query(
    `SELECT id, amount, status, reason, created_at
     FROM refunds
     WHERE order_id = $1
     ORDER BY created_at ASC`,
    [orderId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

export async function hydrateOrder(row) {
  const [items, history, payments, refunds] = await Promise.all([
    loadItems(row.id),
    loadHistory(row.id),
    loadPayments(row.id),
    loadRefunds(row.id),
  ]);
  return mapOrder(row, { items, history, payments, refunds });
}

export async function getOrderById(orderId) {
  const expired = await withTransaction((client) => expireOrderIfDue(client, orderId));
  return hydrateOrder(expired);
}

export async function listOrders({ email } = {}) {
  await expireDueReservations();
  const params = [];
  let where = "";
  if (email && String(email).trim()) {
    params.push(String(email).trim().toLowerCase());
    where = `WHERE customer_email = $1`;
  }
  const result = await pool.query(
    `SELECT * FROM orders ${where} ORDER BY created_at DESC`,
    params
  );
  const orders = [];
  for (const row of result.rows) {
    orders.push(await hydrateOrder(row));
  }
  return orders;
}

export async function expireDueReservations() {
  return withTransaction(async (client) => {
    const due = await client.query(
      `SELECT id FROM orders
       WHERE status = 'reserved'
         AND reservation_expires_at IS NOT NULL
         AND reservation_expires_at <= NOW()
       FOR UPDATE SKIP LOCKED`
    );

    let expired = 0;
    for (const row of due.rows) {
      const updated = await releaseReservation(
        client,
        row.id,
        "expired",
        "Reservation auto-expired after 5 minutes"
      );
      if (updated) expired += 1;
    }
    return expired;
  });
}
