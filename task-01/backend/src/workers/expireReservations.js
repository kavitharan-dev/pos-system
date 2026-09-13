import { expireDueReservations } from "../services/orders.js";

const INTERVAL_MS = 2000;

export function startReservationExpiryWorker() {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const count = await expireDueReservations();
      if (count > 0) {
        console.log(`[expiry-worker] released ${count} expired reservation(s)`);
      }
    } catch (err) {
      console.error("[expiry-worker]", err.message);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
  tick();
  return timer;
}
