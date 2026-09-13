import { initPool } from "../db/pool.js";
import { AppError, notFound } from "../errors.js";

const pool = { query: (...args) => initPool().query(...args) };

const CATEGORIES = new Set(["Electronics", "Accessories", "Home", "Other"]);

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    stock: row.stock,
    category: row.category || "Other",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseProductInput({ name, price, stock, category }) {
  if (!name || String(name).trim() === "") {
    throw new AppError(400, "VALIDATION_ERROR", "Product name is required");
  }
  const parsedPrice = Number(price);
  const parsedStock = Number(stock);
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Price must be a number >= 0");
  }
  if (!Number.isInteger(parsedStock) || parsedStock < 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Stock must be an integer >= 0");
  }
  const nextCategory = String(category || "Other").trim() || "Other";
  if (!CATEGORIES.has(nextCategory)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid category");
  }
  return {
    name: String(name).trim(),
    price: parsedPrice,
    stock: parsedStock,
    category: nextCategory,
  };
}

export async function listProducts() {
  const result = await pool.query(`SELECT * FROM products ORDER BY name ASC`);
  return result.rows.map(mapProduct);
}

export async function getProduct(id) {
  const result = await pool.query(`SELECT * FROM products WHERE id = $1`, [id]);
  if (result.rowCount === 0) throw notFound("Product", id);
  return mapProduct(result.rows[0]);
}

export async function createProduct(input) {
  const product = parseProductInput(input);
  const result = await pool.query(
    `INSERT INTO products (name, price, stock, category)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [product.name, product.price, product.stock, product.category]
  );
  return mapProduct(result.rows[0]);
}

export async function updateProduct(id, patch) {
  const current = await getProduct(id);
  const product = parseProductInput({ ...current, ...patch });
  const result = await pool.query(
    `UPDATE products
     SET name = $2, price = $3, stock = $4, category = $5, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, product.name, product.price, product.stock, product.category]
  );
  return mapProduct(result.rows[0]);
}

export async function deleteProduct(id) {
  await getProduct(id);
  try {
    await pool.query(`DELETE FROM products WHERE id = $1`, [id]);
  } catch (err) {
    if (err?.code === "23503") {
      throw new AppError(
        409,
        "PRODUCT_IN_USE",
        "Cannot delete a product that is referenced by a cart or order"
      );
    }
    throw err;
  }
}

export async function getInventory() {
  const result = await pool.query(
    `SELECT id, name, price, stock, category, updated_at
     FROM products
     ORDER BY name ASC`
  );
  return result.rows.map((row) => ({
    productId: row.id,
    name: row.name,
    category: row.category || "Other",
    price: Number(row.price),
    stock: row.stock,
    status:
      row.stock === 0 ? "Out of Stock" : row.stock <= 5 ? "Low Stock" : "In Stock",
    updatedAt: row.updated_at,
  }));
}
