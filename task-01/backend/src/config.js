import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4001,
  databaseUrl: process.env.DATABASE_URL || "",
  reservationMinutes: Number(process.env.RESERVATION_MINUTES) || 5,
  paymentTimeoutMs: Number(process.env.PAYMENT_TIMEOUT_MS) || 2500,
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  seedOnStart: process.env.SEED_ON_START !== "false",
};

export const frontendDist = path.resolve(__dirname, "../../frontend/dist");
