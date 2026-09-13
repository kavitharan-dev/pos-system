import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

export let pool;

export function initPool(connectionString = config.databaseUrl) {
  if (pool) return pool;
  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
  });
  return pool;
}

export async function withTransaction(fn) {
  const client = await initPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDb() {
  const result = await initPool().query("SELECT 1 AS ok");
  return result.rows[0].ok === 1;
}
