import { dirname, join } from "node:path";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import express from "express";
import { describe, expect, it } from "vitest";
import { createDb, migrate } from "../src/db.js";
import { createApiRouter } from "../src/recipes.js";

/**
 * Real-Postgres checks (FK order, unique wa_id, member reuse). Opt in with
 * TEST_DATABASE_URL=postgres://... ; skipped otherwise so unit runs stay fast.
 */
const url = process.env.TEST_DATABASE_URL;
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

function json(base: string, path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!url)("postgres integration", () => {
  it("registers, links WA, and creates a recipe without FK errors", async () => {
    const db = createDb(url!);
    await migrate(db, migrationsDir);

    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createApiRouter({
        db,
        sessionSecret: "integration",
        creds: { whatsappToken: "w", phoneNumberId: "p" },
        sendCallButton: async () => {},
      }),
    );
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const email = `it-${Date.now()}-${Math.random().toString(16).slice(2)}@vault.test`;
    const waId = `62812${Date.now().toString().slice(-8)}`;
    try {
      const reg = await json(base, "/api/register", {
        email,
        password: "rahasia123",
        role: "author",
        waId,
      });
      expect(reg.status).toBe(201);
      const cookie = reg.headers.getSetCookie()[0].split(";")[0];

      const created = await json(base, "/api/recipes", { name: "Rendang" }, cookie);
      expect(created.status).toBe(201);
      const recipeId = ((await created.json()) as { id: string }).id;

      const cook = await json(base, "/api/cook-sessions", { recipeId }, cookie);
      expect(cook.status).toBe(201);

      const detail = await fetch(`${base}/api/recipes/${recipeId}`, { headers: { cookie } });
      expect(detail.status).toBe(200);

      const members = await db.query(
        "SELECT count(*)::int AS n FROM members m JOIN users u ON u.family_id = m.family_id WHERE u.email = $1",
        [email],
      );
      expect(members.rows[0].n).toBe(1);

      const linked = await db.query("SELECT wa_id FROM users WHERE email = $1", [email]);
      expect(linked.rows[0].wa_id).toBe(waId);
    } finally {
      server.close();
      await db.query(
        "DELETE FROM call_sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
        [email],
      );
      await db.query("DELETE FROM recipes WHERE author_user_id IN (SELECT id FROM users WHERE email = $1)", [email]);
      await db.query("DELETE FROM members WHERE family_id IN (SELECT family_id FROM users WHERE email = $1)", [email]);
      await db.query("DELETE FROM users WHERE email = $1", [email]);
      await db.query("DELETE FROM families WHERE name LIKE $1", [`Keluarga %${email}`]);
    }
  });
});
