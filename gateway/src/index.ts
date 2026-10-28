import dotenv from "dotenv";
import express from "express";
import { Redis } from "ioredis";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createDb, migrate } from "./db.js";
import { createApiRouter } from "./recipes.js";
import { createRouter, jsonParser } from "./routes.js";

dotenv.config();

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

async function boot(): Promise<void> {
  const config = loadConfig();
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });
  const db = createDb(config.databaseUrl);
  const applied = await migrate(db, config.migrationsDir);
  console.log(`migrations applied: ${applied.join(", ")}`);

  const app = express();
  app.use(jsonParser);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use(createRouter({ redis, config }));
  app.use("/api", createApiRouter({ db, sessionSecret: config.sessionSecret, creds: config }));
  app.use(express.static(join(rootDir, "public")));

  app.listen(config.port, () => {
    console.log(`gateway listening on :${config.port}`);
  });
}

boot().catch((err: unknown) => {
  console.error("boot failed", err);
  process.exit(1);
});
