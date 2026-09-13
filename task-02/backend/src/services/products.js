import { pool } from "../db/pool.js";
import { AppError, notFound } from "../errors.js";

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    stock: row.stock,
    category: row.category,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProducts(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.q && String(filters.q).trim()) {
    params.push(`%${String(filters.q).trim()}%`);
    clauses.push(
      `(name ILIKE $${params.length} OR description ILIKE $${params.length} OR category ILIKE $${params.length})`
    );
  }
  if (filters.category && String(filters.category).trim()) {
    params.push(String(filters.category).trim());
    clauses.push(`category = $${params.length}`);
  }
  if (filters.minPrice !== undefined && filters.minPrice !== "" && filters.minPrice !== null) {
    const min = Number(filters.minPrice);
    if (Number.isFinite(min)) {
      params.push(min);
      clauses.push(`price >= $${params.length}`);
    }
  }
  if (filters.maxPrice !== undefined && filters.maxPrice !== "" && filters.maxPrice !== null) {
    const max = Number(filters.maxPrice);
    if (Number.isFinite(max)) {
      params.push(max);
      clauses.push(`price <= $${params.length}`);
    }
  }
  if (filters.availability === "in_stock") {
    clauses.push("stock > 0");
  } else if (filters.availability === "out_of_stock") {
    clauses.push("stock = 0");
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT * FROM products ${where} ORDER BY name ASC`,
    params
  );
  return result.rows.map(mapProduct);
}

export async function listCategories() {
  const result = await pool.query(
    `SELECT DISTINCT category FROM products ORDER BY category ASC`
  );
  return result.rows.map((row) => row.category);
}

export async function getProduct(id) {
  const result = await pool.query(`SELECT * FROM products WHERE id = $1`, [id]);
  if (result.rowCount === 0) throw notFound("Product", id);
  return mapProduct(result.rows[0]);
}

export async function createProduct({ name, price, stock, category, description }) {
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

  const result = await pool.query(
    `INSERT INTO products (name, price, stock, category, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      String(name).trim(),
      parsedPrice,
      parsedStock,
      String(category || "Other").trim() || "Other",
      String(description || "").trim(),
    ]
  );
  return mapProduct(result.rows[0]);
}

export async function updateProduct(id, patch) {
  const current = await getProduct(id);
  const name = patch.name !== undefined ? String(patch.name).trim() : current.name;
  const price = patch.price !== undefined ? Number(patch.price) : current.price;
  const stock = patch.stock !== undefined ? Number(patch.stock) : current.stock;
  const category =
    patch.category !== undefined ? String(patch.category).trim() : current.category;
  const description =
    patch.description !== undefined ? String(patch.description) : current.description;

  if (!name) {
    throw new AppError(400, "VALIDATION_ERROR", "Product name is required");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Price must be a number >= 0");
  }
  if (!Number.isInteger(stock) || stock < 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Stock must be an integer >= 0");
  }

  const result = await pool.query(
    `UPDATE products
     SET name = $2, price = $3, stock = $4, category = $5, description = $6, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, name, price, stock, category || "Other", description]
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
    category: row.category,
    price: Number(row.price),
    stock: row.stock,
    status:
      row.stock === 0 ? "Out of Stock" : row.stock <= 5 ? "Low Stock" : "In Stock",
    updatedAt: row.updated_at,
  }));
}
