import { config } from "../config.js";
import { withTransaction } from "../db/pool.js";
import { AppError } from "../errors.js";
import { expireOrderIfDue, releaseReservation, restoreStockForOrder } from "./inventory.js";
import { assertTransition, logStatus } from "./status.js";
import { getOrderById } from "./orders.js";

const OUTCOMES = new Set(["success", "failure", "timeout"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function insertPayment(client, orderId, outcome, status) {
  await client.query(
    `INSERT INTO payments (order_id, outcome, status)
     VALUES ($1, $2, $3)`,
    [orderId, outcome, status]
  );
}

/**
 * Mock payment gateway.
 *
 * success  → confirm order (stock already reserved, stays deducted)
 * failure  → mark failed and release reserved stock
 * timeout  → expire reservation and release stock
 *
 * Duplicate submissions for the same order are rejected:
 * already paid / failed / expired / cancelled, or a payment already in flight.
 */
export async function payOrder(orderId, outcome) {
  if (!OUTCOMES.has(outcome)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Payment outcome must be success, failure, or timeout"
    );
  }

  await withTransaction(async (client) => {
    const order = await expireOrderIfDue(client, orderId);

    if (order.payment_in_progress) {
      throw new AppError(
        409,
        "DUPLICATE_SUBMISSION",
        "A payment attempt is already in progress for this order"
      );
    }

    if (order.status === "paid") {
      await insertPayment(client, orderId, outcome, "rejected_duplicate");
      throw new AppError(
        409,
        "DUPLICATE_SUBMISSION",
        "This order has already been paid"
      );
    }

    if (["failed", "expired", "cancelled"].includes(order.status)) {
      await insertPayment(client, orderId, outcome, "rejected_duplicate");
      throw new AppError(
        409,
        "DUPLICATE_SUBMISSION",
        `Order is ${order.status} and cannot accept another payment`
      );
    }

    if (order.status !== "reserved") {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        `Cannot pay an order in status '${order.status}'`
      );
    }

    await client.query(
      `UPDATE orders
       SET payment_in_progress = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [orderId]
    );
  });

  const delay =
    outcome === "timeout" ? config.paymentTimeoutMs : Math.min(600, config.paymentTimeoutMs);
  await sleep(delay);

  await withTransaction(async (client) => {
    const order = await expireOrderIfDue(client, orderId);

    if (order.status !== "reserved") {
      await insertPayment(client, orderId, outcome, "rejected_stale");
      if (order.payment_in_progress) {
        await client.query(
          `UPDATE orders SET payment_in_progress = FALSE, updated_at = NOW() WHERE id = $1`,
          [orderId]
        );
      }
      if (outcome === "timeout" && order.status === "expired") {
        return;
      }
      throw new AppError(
        409,
        "DUPLICATE_SUBMISSION",
        `Order is ${order.status} and cannot accept another payment`
      );
    }

    if (outcome === "success") {
      assertTransition("reserved", "paid");
      const paid = await client.query(
        `UPDATE orders
         SET status = 'paid',
             payment_in_progress = FALSE,
             reservation_expires_at = NULL,
             updated_at = NOW()
         WHERE id = $1 AND status = 'reserved'
         RETURNING *`,
        [orderId]
      );
      if (paid.rowCount === 0) {
        await insertPayment(client, orderId, outcome, "rejected_stale");
        throw new AppError(
          409,
          "DUPLICATE_SUBMISSION",
          "Order is no longer reserved"
        );
      }
      await logStatus(client, orderId, "reserved", "paid", "Payment successful");
      await insertPayment(client, orderId, outcome, "succeeded");
      return;
    }

    if (outcome === "failure") {
      const failed = await releaseReservation(
        client,
        orderId,
        "failed",
        "Payment failed — reserved stock released"
      );
      await insertPayment(client, orderId, outcome, "failed");
      if (!failed) {
        throw new AppError(
          409,
          "DUPLICATE_SUBMISSION",
          "Order is no longer reserved"
        );
      }
      return;
    }

    const expired = await releaseReservation(
      client,
      orderId,
      "expired",
      "Payment gateway timeout — reservation expired"
    );
    await insertPayment(client, orderId, outcome, "timed_out");
    if (!expired) {
      await expireOrderIfDue(client, orderId);
    }
  });

  return getOrderById(orderId);
}

export async function cancelOrder(orderId) {
  await withTransaction(async (client) => {
    const order = await expireOrderIfDue(client, orderId);

    if (order.status === "cancelled") {
      throw new AppError(409, "INVALID_TRANSITION", "Order is already cancelled");
    }
    if (order.status === "expired") {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        "Expired orders cannot be cancelled"
      );
    }
    if (order.status === "failed") {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        "Failed orders have already released stock"
      );
    }
    if (order.payment_in_progress) {
      throw new AppError(
        409,
        "PAYMENT_IN_PROGRESS",
        "Cannot cancel while a payment attempt is in progress"
      );
    }

    assertTransition(order.status, "cancelled");

    if (order.status === "reserved") {
      const cancelled = await releaseReservation(
        client,
        orderId,
        "cancelled",
        "Order cancelled — reserved stock restored"
      );
      if (!cancelled) {
        throw new AppError(409, "INVALID_TRANSITION", "Order is no longer reserved");
      }
      return;
    }

    await restoreStockForOrder(client, orderId);
    const cancelled = await client.query(
      `UPDATE orders
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND status = 'paid'
       RETURNING *`,
      [orderId]
    );
    if (cancelled.rowCount === 0) {
      throw new AppError(409, "INVALID_TRANSITION", "Order could not be cancelled");
    }
    await client.query(
      `INSERT INTO refunds (order_id, amount, status, reason)
       VALUES ($1, $2, 'simulated', $3)`,
      [orderId, order.subtotal, "Simulated refund for cancelled paid order"]
    );
    await logStatus(
      client,
      orderId,
      "paid",
      "cancelled",
      "Paid order cancelled — stock restored and refund simulated"
    );
  });

  return getOrderById(orderId);
}
