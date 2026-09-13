import { migrate } from "./db/schema.js";
import { initPool, pool } from "./db/pool.js";
import { ensureDatabase } from "./db/ensureDatabase.js";
import { seedIfEmpty } from "./seed.js";

const url = await ensureDatabase({ dbName: "pos_task02", port: 55433 });
initPool(url);
await migrate();
await seedIfEmpty();
await pool.end();
