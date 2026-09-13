import { pool } from "./db/pool.js";

export const DEMO_PRODUCTS = [
  {
    name: "Wireless Mouse",
    price: 12.99,
    stock: 18,
    category: "Electronics",
    description: "Compact 2.4 GHz wireless mouse with silent clicks and a 12-month battery.",
  },
  {
    name: "Mechanical Keyboard",
    price: 99.99,
    stock: 7,
    category: "Electronics",
    description: "Full-size mechanical keyboard with hot-swappable switches and RGB lighting.",
  },
  {
    name: "USB-C Cable",
    price: 6.99,
    stock: 42,
    category: "Accessories",
    description: "1m braided USB-C cable rated for 60W charging and data transfer.",
  },
  {
    name: "Laptop Stand",
    price: 24.99,
    stock: 9,
    category: "Accessories",
    description: "Aluminum laptop stand that lifts the screen to eye level and improves airflow.",
  },
  {
    name: "Bluetooth Headphones",
    price: 49.99,
    stock: 3,
    category: "Electronics",
    description: "Over-ear Bluetooth headphones with 30-hour battery life and a built-in mic.",
  },
  {
    name: "Webcam",
    price: 39.99,
    stock: 15,
    category: "Electronics",
    description: "1080p webcam with auto-focus and a privacy shutter for daily calls.",
  },
  {
    name: "Gaming Chair",
    price: 149.99,
    stock: 6,
    category: "Home",
    description: "Ergonomic gaming chair with lumbar support and adjustable armrests.",
  },
  {
    name: 'Monitor 24"',
    price: 179.99,
    stock: 11,
    category: "Electronics",
    description: "24-inch 1080p IPS monitor with thin bezels and HDMI plus DisplayPort.",
  },
];

export async function seedIfEmpty() {
  const count = await pool.query(`SELECT COUNT(*)::int AS n FROM products`);
  if (count.rows[0].n > 0) return 0;

  for (const product of DEMO_PRODUCTS) {
    await pool.query(
      `INSERT INTO products (name, price, stock, category, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [product.name, product.price, product.stock, product.category, product.description]
    );
  }
  console.log(`Seeded ${DEMO_PRODUCTS.length} products`);
  return DEMO_PRODUCTS.length;
}
