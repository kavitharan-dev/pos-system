import { config } from "./config.js";
import { migrate } from "./db/schema.js";
import { initPool, pingDb } from "./db/pool.js";
import { ensureDatabase } from "./db/ensureDatabase.js";
import { seedIfEmpty } from "./seed.js";
import { createApp } from "./app.js";
import { startReservationExpiryWorker } from "./workers/expireReservations.js";

async function main() {
  const url = await ensureDatabase({ dbName: "pos_task02", port: 55433 });
  initPool(url);
  await migrate();
  await pingDb();
  if (config.seedOnStart) {
    await seedIfEmpty();
  }

  startReservationExpiryWorker();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Task 02 storefront API listening on http://localhost:${config.port}`);
    console.log(`Stock reservations expire after ${config.reservationMinutes} minute(s)`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
