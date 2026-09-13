import { pool } from "../db/pool.js";
import { AppError, notFound } from "../errors.js";

function mapCart(cart, items) {
  const mappedItems = items.map((row) => ({
    productId: row.product_id,
    name: row.name,
    price: Number(row.price),
    stock: row.stock,
    quantity: row.quantity,
    lineTotal: Number(row.price) * row.quantity,
  }));
  const subtotal = mappedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    id: cart.id,
    items: mappedItems,
    itemCount: mappedItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    createdAt: cart.created_at,
    updatedAt: cart.updated_at,
  };
}

export async function createCart() {
  const result = await pool.query(
    `INSERT INTO carts DEFAULT VALUES RETURNING *`
  );
  return mapCart(result.rows[0], []);
}

export async function getCart(cartId) {
  const cart = await pool.query(`SELECT * FROM carts WHERE id = $1`, [cartId]);
  if (cart.rowCount === 0) throw notFound("Cart", cartId);

  const items = await pool.query(
    `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1
     ORDER BY p.name`,
    [cartId]
  );
  return mapCart(cart.rows[0], items.rows);
}

export async function addCartItem(cartId, productId, quantity) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    throw new AppError(400, "VALIDATION_ERROR", "Quantity must be an integer >= 1");
  }

  await getCart(cartId);

  const product = await pool.query(`SELECT * FROM products WHERE id = $1`, [
    productId,
  ]);
  if (product.rowCount === 0) throw notFound("Product", productId);

  const existing = await pool.query(
    `SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2`,
    [cartId, productId]
  );
  const nextQty = (existing.rows[0]?.quantity || 0) + qty;
  if (nextQty > product.rows[0].stock) {
    throw new AppError(
      409,
      "INSUFFICIENT_STOCK",
      `Only ${product.rows[0].stock} unit(s) of "${product.rows[0].name}" available`,
      { available: product.rows[0].stock, requested: nextQty }
    );
  }

  await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
    [cartId, productId, qty]
  );
  await pool.query(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
  return getCart(cartId);
}

export async function setCartItemQuantity(cartId, productId, quantity) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Quantity must be an integer >= 0");
  }

  if (qty === 0) {
    return removeCartItem(cartId, productId);
  }

  await getCart(cartId);
  const product = await pool.query(`SELECT * FROM products WHERE id = $1`, [
    productId,
  ]);
  if (product.rowCount === 0) throw notFound("Product", productId);
  if (qty > product.rows[0].stock) {
    throw new AppError(
      409,
      "INSUFFICIENT_STOCK",
      `Only ${product.rows[0].stock} unit(s) of "${product.rows[0].name}" available`,
      { available: product.rows[0].stock, requested: qty }
    );
  }

  const updated = await pool.query(
    `UPDATE cart_items SET quantity = $3
     WHERE cart_id = $1 AND product_id = $2
     RETURNING *`,
    [cartId, productId, qty]
  );
  if (updated.rowCount === 0) {
    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)`,
      [cartId, productId, qty]
    );
  }
  await pool.query(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
  return getCart(cartId);
}

export async function removeCartItem(cartId, productId) {
  await getCart(cartId);
  await pool.query(
    `DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2`,
    [cartId, productId]
  );
  await pool.query(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
  return getCart(cartId);
}

export async function clearCart(cartId) {
  await getCart(cartId);
  await pool.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
  await pool.query(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
  return getCart(cartId);
}
