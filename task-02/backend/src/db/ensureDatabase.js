import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function canConnect(url) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

/**
 * Use DATABASE_URL when it is reachable. Otherwise start a local embedded
 * PostgreSQL so the assessment can run on a machine without Docker.
 */
export async function ensureDatabase({ dbName, port }) {
  const embeddedUrl = `postgres://pos:pos@127.0.0.1:${port}/${dbName}`;
  const candidates = [config.databaseUrl, embeddedUrl].filter(Boolean);

  for (const url of candidates) {
    if (await canConnect(url)) {
      config.databaseUrl = url;
      process.env.DATABASE_URL = url;
      return url;
    }
  }

  if (config.nodeEnv === "production") {
    throw new Error("DATABASE_URL is required in production");
  }

  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const databaseDir = path.resolve(__dirname, "../../.pg-data");
  fs.mkdirSync(databaseDir, { recursive: true });

  const server = new EmbeddedPostgres({
    databaseDir,
    user: "pos",
    password: "pos",
    port,
    persistent: true,
  });

  const alreadyInitialized = fs.existsSync(path.join(databaseDir, "PG_VERSION"));
  if (!alreadyInitialized) {
    await server.initialise();
  }

  try {
    await server.start();
  } catch (err) {
    if (await canConnect(embeddedUrl)) {
      config.databaseUrl = embeddedUrl;
      process.env.DATABASE_URL = embeddedUrl;
      return embeddedUrl;
    }
    throw err;
  }

  try {
    await server.createDatabase(dbName);
  } catch (err) {
    const message = String(err?.message || err);
    if (!/already|exist/i.test(message)) {
      throw err;
    }
  }

  config.databaseUrl = embeddedUrl;
  process.env.DATABASE_URL = embeddedUrl;
  console.log(`Started embedded PostgreSQL on port ${port} (${dbName})`);
  return embeddedUrl;
}
