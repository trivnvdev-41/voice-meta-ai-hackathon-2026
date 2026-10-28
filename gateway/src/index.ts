import dotenv from "dotenv";
import express from "express";
import { Redis } from "ioredis";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createDb, migrate } from "./db.js";
import { createPresigner } from "./media.js";
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
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      console.log(
        `${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`,
      );
    });
    next();
  });
  app.use(jsonParser);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use(createRouter({ redis, config }));
  app.use("/api", createApiRouter({
    db,
    sessionSecret: config.sessionSecret,
    creds: config,
    presign: createPresigner(config),
  }));
  app.use(express.static(join(rootDir, "public")));

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      console.error("request failed", err);
      if (res.headersSent) return next(err);
      res.status(500).json({ error: "internal error" });
    },
  );

  app.listen(config.port, () => {
    console.log(`gateway listening on :${config.port}`);
  });
}

boot().catch((err: unknown) => {
  console.error("boot failed", err);
  process.exit(1);
});
