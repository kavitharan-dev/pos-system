import { initPool } from "./db/pool.js";

const pool = { query: (...args) => initPool().query(...args) };

export const DEMO_PRODUCTS = [
  { name: "Wireless Mouse", price: 12.99, stock: 18, category: "Electronics" },
  { name: "Mechanical Keyboard", price: 99.99, stock: 7, category: "Electronics" },
  { name: "USB-C Cable", price: 6.99, stock: 42, category: "Accessories" },
  { name: "Laptop Stand", price: 24.99, stock: 9, category: "Accessories" },
  { name: "Bluetooth Headphones", price: 49.99, stock: 3, category: "Electronics" },
  { name: "Webcam", price: 39.99, stock: 15, category: "Electronics" },
  { name: "Gaming Chair", price: 149.99, stock: 6, category: "Home" },
  { name: 'Monitor 24"', price: 179.99, stock: 11, category: "Electronics" },
];

export async function seedIfEmpty() {
  const count = await pool.query(`SELECT COUNT(*)::int AS n FROM products`);
  if (count.rows[0].n === 0) {
    for (const product of DEMO_PRODUCTS) {
      await pool.query(
        `INSERT INTO products (name, price, stock, category) VALUES ($1, $2, $3, $4)`,
        [product.name, product.price, product.stock, product.category]
      );
    }
    console.log(`Seeded ${DEMO_PRODUCTS.length} products`);
    return DEMO_PRODUCTS.length;
  }

  for (const product of DEMO_PRODUCTS) {
    await pool.query(
      `UPDATE products SET category = $2 WHERE name = $1 AND (category = 'Other' OR category IS NULL)`,
      [product.name, product.category]
    );
  }
  return 0;
}
