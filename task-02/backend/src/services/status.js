import { AppError } from "../errors.js";

/**
 * Allowed order-status transitions. Anything else is rejected.
 *
 * pending  → reserved                         (checkout locks stock)
 * reserved → paid | failed | expired | cancelled
 * paid     → cancelled                        (restore stock)
 * failed / expired / cancelled → terminal
 */
export const ALLOWED_TRANSITIONS = {
  pending: ["reserved"],
  reserved: ["paid", "failed", "expired", "cancelled"],
  paid: ["cancelled"],
  failed: [],
  expired: [],
  cancelled: [],
};

export const TERMINAL_STATUSES = ["failed", "expired", "cancelled"];

export function assertTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new AppError(
      409,
      "INVALID_TRANSITION",
      `Cannot transition order from '${from}' to '${to}'`,
      { from, to, allowed }
    );
  }
}

export async function logStatus(client, orderId, fromStatus, toStatus, reason) {
  await client.query(
    `INSERT INTO order_status_events (order_id, from_status, to_status, reason)
     VALUES ($1, $2, $3, $4)`,
    [orderId, fromStatus, toStatus, reason || null]
  );
}

export async function lockOrder(client, orderId) {
  const result = await client.query(
    `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId]
  );
  if (result.rowCount === 0) {
    throw new AppError(404, "NOT_FOUND", "Order not found", { id: orderId });
  }
  return result.rows[0];
}

export function mapOrder(row, extras = {}) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    cartId: row.cart_id,
    status: row.status,
    reservationExpiresAt: row.reservation_expires_at,
    paymentInProgress: row.payment_in_progress,
    subtotal: Number(row.subtotal),
    customerName: row.customer_name || "Guest",
    customerEmail: row.customer_email || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...extras,
  };
}
