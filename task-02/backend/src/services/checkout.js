import { config } from "../config.js";
import { withTransaction } from "../db/pool.js";
import { AppError } from "../errors.js";
import { lockProducts } from "./inventory.js";
import { logStatus } from "./status.js";
import { getOrderById } from "./orders.js";

/**
 * Enter checkout: convert a cart into a Reserved order and lock stock.
 *
 * Concurrency: all involved product rows are locked with SELECT ... FOR UPDATE
 * in id order, then stock is decremented with a WHERE stock >= qty guard.
 * Two simultaneous checkouts for the last unit cannot both succeed.
 */
export async function checkoutCart(cartId, customer = {}) {
  if (!cartId) {
    throw new AppError(400, "VALIDATION_ERROR", "cartId is required");
  }
  const customerName = String(customer.customerName || "").trim() || "Guest";
  const customerEmail = String(customer.customerEmail || "").trim().toLowerCase();
  if (!customerEmail || !customerEmail.includes("@")) {
    throw new AppError(400, "VALIDATION_ERROR", "A valid customer email is required");
  }

  const orderId = await withTransaction(async (client) => {
    const cart = await client.query(`SELECT * FROM carts WHERE id = $1 FOR UPDATE`, [
      cartId,
    ]);
    if (cart.rowCount === 0) {
      throw new AppError(404, "NOT_FOUND", "Cart not found", { id: cartId });
    }

    const existing = await client.query(
      `SELECT id, order_number, status FROM orders WHERE cart_id = $1`,
      [cartId]
    );
    if (existing.rowCount > 0) {
      throw new AppError(
        409,
        "DUPLICATE_SUBMISSION",
        `Cart already submitted as order ${existing.rows[0].order_number}`,
        { orderId: existing.rows[0].id, status: existing.rows[0].status }
      );
    }

    const items = await client.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1`,
      [cartId]
    );
    if (items.rowCount === 0) {
      throw new AppError(400, "EMPTY_CART", "Cannot checkout an empty cart");
    }

    const productIds = items.rows.map((row) => row.product_id);
    const locked = await lockProducts(client, productIds);
    const byId = new Map(locked.map((row) => [row.id, row]));

    for (const item of items.rows) {
      const product = byId.get(item.product_id);
      if (!product) {
        throw new AppError(404, "NOT_FOUND", "Product not found", {
          id: item.product_id,
        });
      }
      if (product.stock < item.quantity) {
        throw new AppError(
          409,
          "INSUFFICIENT_STOCK",
          `Not enough stock for "${product.name}"`,
          {
            productId: product.id,
            available: product.stock,
            requested: item.quantity,
          }
        );
      }
    }

    let subtotal = 0;
    for (const item of items.rows) {
      const product = byId.get(item.product_id);
      const decremented = await client.query(
        `UPDATE products
         SET stock = stock - $2, updated_at = NOW()
         WHERE id = $1 AND stock >= $2
         RETURNING stock`,
        [product.id, item.quantity]
      );
      if (decremented.rowCount === 0) {
        throw new AppError(
          409,
          "INSUFFICIENT_STOCK",
          `Not enough stock for "${product.name}"`,
          { productId: product.id, requested: item.quantity }
        );
      }
      subtotal += Number(product.price) * item.quantity;
    }

    const pending = await client.query(
      `INSERT INTO orders (order_number, cart_id, status, subtotal, customer_name, customer_email)
       VALUES ('ORD-' || nextval('order_number_seq'), $1, 'pending', $2, $3, $4)
       RETURNING *`,
      [cartId, subtotal, customerName, customerEmail]
    );
    const order = pending.rows[0];
    await logStatus(client, order.id, null, "pending", "Order created from cart");

    const reserved = await client.query(
      `UPDATE orders
       SET status = 'reserved',
           reservation_expires_at = NOW() + ($2 * INTERVAL '1 minute'),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [order.id, config.reservationMinutes]
    );
    await logStatus(
      client,
      order.id,
      "pending",
      "reserved",
      `Stock reserved for ${config.reservationMinutes} minutes`
    );

    for (const item of items.rows) {
      const product = byId.get(item.product_id);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, product.id, product.name, product.price, item.quantity]
      );
    }

    return reserved.rows[0].id;
  });

  return getOrderById(orderId);
}
