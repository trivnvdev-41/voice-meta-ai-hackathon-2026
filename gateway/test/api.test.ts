import { Socket, type AddressInfo } from "node:net";
import express from "express";
import { describe, expect, it } from "vitest";
import { signSession } from "../src/auth.js";
import type { Db, DbRow } from "../src/db.js";
import { createApiRouter } from "../src/recipes.js";
import type { CallButtonOptions } from "../src/whatsapp.js";

const SECRET = "test-session-secret";

const sentButtons: { to: string; opts: CallButtonOptions }[] = [];

class FakeDb implements Db {
  users: DbRow[] = [];
  families: DbRow[] = [];
  members: DbRow[] = [];
  recipes: DbRow[] = [];
  sessions: DbRow[] = [];

  async query(text: string, params: unknown[]): Promise<{ rows: DbRow[]; rowCount: number }> {
    const p = params as any[];
    if (text.includes("INSERT INTO users")) {
      // VALUES ($1, $2, NULL, $3, $4, $5, $6): wa_id is a NULL literal
      const [id, email, family_id, password_hash, role, display_name] = p;
      this.users.push({ id, email, wa_id: null, family_id, password_hash, role, display_name });
      return { rows: [], rowCount: 1 };
    }
    if (text.includes("FROM users WHERE email")) {
      return { rows: this.users.filter((u) => u.email === p[0]), rowCount: 1 };
    }
    if (text.includes("FROM users WHERE id")) {
      const rows = this.users
        .filter((u) => u.id === p[0])
        .map(({ password_hash, ...rest }) => rest);
      return { rows, rowCount: rows.length };
    }
    if (text.includes("INSERT INTO call_sessions")) {
      const [id, user_id, wa_caller, recipe_id, cta_payload] = p;
      this.sessions.push({ id, user_id, wa_caller, recipe_id, cta_payload, status: "pending" });
      return { rows: [], rowCount: 1 };
    }
    if (text.includes("SELECT family_id FROM users")) {
      const user = this.users.find((u) => u.id === p[0]);
      return { rows: user ? [{ family_id: user.family_id }] : [], rowCount: 1 };
    }
    if (text.includes("INSERT INTO families")) {
      this.families.push({ id: p[0], name: p[1] });
      return { rows: [], rowCount: 1 };
    }
    if (text.includes("INSERT INTO members")) {
      const [id, family_id, wa_id, role, display_name] = p;
      this.members.push({ id, family_id, wa_id, role, display_name });
      return { rows: [], rowCount: 1 };
    }
    if (text.includes("INSERT INTO recipes")) {
      const [id, family_id, contributor_member_id, author_user_id, wa_message_id, name,
        creator_name, family_name, region, language, ingredients, steps, story, visibility] = p;
      this.recipes.push({
        id, family_id, contributor_member_id, author_user_id, wa_message_id, name,
        creator_name, family_name, region, language,
        ingredients: JSON.parse(ingredients), steps: JSON.parse(steps), story, visibility,
      });
      return { rows: [{ id }], rowCount: 1 };
    }
    if (text.includes("UPDATE recipes")) {
      const id = p[p.length - 1];
      const row = this.recipes.find((r) => r.id === id);
      if (!row) return { rows: [], rowCount: 0 };
      const [name, creator_name, family_name, region, language, ingredients, steps, story, visibility] = p;
      Object.assign(row, {
        name, creator_name, family_name, region, language,
        ingredients: JSON.parse(ingredients), steps: JSON.parse(steps), story, visibility,
      });
      return { rows: [], rowCount: 1 };
    }
    if (text.includes("DELETE FROM recipes")) {
      const before = this.recipes.length;
      this.recipes = this.recipes.filter((r) => r.id !== p[0]);
      return { rows: [], rowCount: before - this.recipes.length };
    }
    if (text.includes("FROM recipes WHERE id")) {
      return { rows: this.recipes.filter((r) => r.id === p[0]), rowCount: 1 };
    }
    if (text.includes("FROM recipes")) {
      const mine = String(p[0]);
      const rows = this.recipes.filter(
        (r) => r.visibility === "public" || (r.author_user_id != null && String(r.author_user_id) === mine && mine !== ""),
      );
      return { rows, rowCount: rows.length };
    }
    throw new Error(`unexpected query: ${text.slice(0, 60)}`);
  }
}

interface CallResult {
  status: number;
  body: any;
  cookies: string[];
}

async function call(
  base: string,
  method: string,
  path: string,
  payload?: unknown,
  cookie?: string,
): Promise<CallResult> {
  const url = new URL(path, base);
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const requestText =
    `${method} ${url.pathname} HTTP/1.1\r\n` +
    `Host: ${url.hostname}\r\n` +
    `Content-Type: application/json\r\n` +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    (cookie ? `Cookie: ${cookie}\r\n` : "") +
    `Connection: close\r\n\r\n` +
    body;
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let data = "";
    socket.on("data", (chunk) => {
      data += chunk.toString();
    });
    socket.on("error", reject);
    socket.on("close", () => {
      const [head, ...rest] = data.split("\r\n\r\n");
      const status = Number(head.match(/^HTTP\/\d\.\d (\d{3})/)?.[1] ?? 0);
      const cookies = head
        .split("\r\n")
        .filter((l) => l.toLowerCase().startsWith("set-cookie:"))
        .map((l) => l.slice("set-cookie:".length).trim().split(";")[0]);
      let parsed: any = null;
      try {
        parsed = JSON.parse(rest.join("\r\n\r\n"));
      } catch {
        parsed = null;
      }
      resolve({ status, body: parsed, cookies });
    });
    socket.connect(Number(url.port), url.hostname, () => socket.end(requestText));
  });
}

async function withApi(fn: (base: string, db: FakeDb) => Promise<void>): Promise<void> {
  const db = new FakeDb();
  sentButtons.length = 0;
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createApiRouter({
      db,
      sessionSecret: SECRET,
      creds: { whatsappToken: "w", phoneNumberId: "p" },
      sendCallButton: async (to, opts) => {
        sentButtons.push({ to, opts });
      },
    }),
  );
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`, db);
  } finally {
    server.close();
  }
}

describe("web platform API", () => {
  it("register → login → create → read → update → delete", async () => {
    await withApi(async (base) => {
      const reg = await call(base, "POST", "/api/register", {
        displayName: "Nenek",
        email: "nenek@vault.id",
        password: "rahasia123",
        role: "author",
      });
      expect(reg.status).toBe(201);
      expect(reg.body.role).toBe("author");
      const cookie = reg.cookies[0];
      expect(cookie).toContain("grv_session=");

      const me = await call(base, "GET", "/api/me", undefined, cookie);
      expect(me.status).toBe(200);
      expect(me.body.email).toBe("nenek@vault.id");

      const created = await call(base, "POST", "/api/recipes", {
        name: "Rendang",
        familyName: "Siregar",
        ingredients: [{ name: "santan", amount_original: "1 butir" }],
        steps: ["Masak sampai minyak naik"],
        visibility: "public",
      }, cookie);
      expect(created.status).toBe(201);
      const id = created.body.id as string;

      const list = await call(base, "GET", "/api/recipes", undefined, cookie);
      expect(list.status).toBe(200);
      expect(list.body.some((r: any) => r.id === id && r.mine)).toBe(true);

      const detail = await call(base, "GET", `/api/recipes/${id}`, undefined, cookie);
      expect(detail.status).toBe(200);
      expect(detail.body.steps).toEqual(["Masak sampai minyak naik"]);

      const updated = await call(base, "PUT", `/api/recipes/${id}`, {
        name: "Rendang Sapi",
        ingredients: [],
        steps: [],
        visibility: "private",
      }, cookie);
      expect(updated.status).toBe(200);

      const gone = await call(base, "DELETE", `/api/recipes/${id}`, undefined, cookie);
      expect(gone.status).toBe(204);

      const missing = await call(base, "GET", `/api/recipes/${id}`, undefined, cookie);
      expect(missing.status).toBe(404);
    });
  });

  it("rejects duplicate email, bad login, anon write, client write", async () => {
    await withApi(async (base) => {
      const first = await call(base, "POST", "/api/register", {
        email: "a@x.id", password: "rahasia123", role: "author",
      });
      expect(first.status).toBe(201);

      const dup = await call(base, "POST", "/api/register", {
        email: "a@x.id", password: "rahasia123",
      });
      expect(dup.status).toBe(409);

      const badLogin = await call(base, "POST", "/api/login", {
        email: "a@x.id", password: "salah",
      });
      expect(badLogin.status).toBe(401);

      const anonWrite = await call(base, "POST", "/api/recipes", { name: "X" });
      expect(anonWrite.status).toBe(401);

      const client = await call(base, "POST", "/api/register", {
        email: "c@x.id", password: "rahasia123", role: "client",
      });
      const clientWrite = await call(base, "POST", "/api/recipes", { name: "X" }, client.cookies[0]);
      expect(clientWrite.status).toBe(403);
    });
  });

  it("hides private recipes from others and anon", async () => {
    await withApi(async (base) => {
      const author = await call(base, "POST", "/api/register", {
        email: "chef@x.id", password: "rahasia123", role: "author",
      });
      const created = await call(base, "POST", "/api/recipes", {
        name: "Secret", visibility: "private",
      }, author.cookies[0]);
      const id = created.body.id as string;

      const other = await call(base, "POST", "/api/register", {
        email: "other@x.id", password: "rahasia123", role: "author",
      });
      expect((await call(base, "GET", `/api/recipes/${id}`, undefined, other.cookies[0])).status).toBe(404);
      expect(await call(base, "GET", `/api/recipes/${id}`).then((r) => r.status)).toBe(404);

      const list = await call(base, "GET", "/api/recipes", undefined, other.cookies[0]);
      expect(list.body.some((r: any) => r.id === id)).toBe(false);
    });
  });

  it("accepts valid session cookie directly", async () => {
    await withApi(async (base, db) => {
      db.users.push({
        id: "u-seeded", email: "s@x.id", password_hash: "x", role: "author", display_name: "S",
      });
      const cookie = `grv_session=${signSession("u-seeded", SECRET)}`;
      const me = await call(base, "GET", "/api/me", undefined, cookie);
      expect(me.status).toBe(200);
      expect(me.body.id).toBe("u-seeded");
    });
  });

  it("cook-sessions: creates session and sends call button", async () => {
    await withApi(async (base, db) => {
      const author = await call(base, "POST", "/api/register", {
        email: "chef@x.id", password: "rahasia123", role: "author",
      });
      db.users.find((u) => u.id === author.body.id)!.wa_id = "62812";
      const created = await call(base, "POST", "/api/recipes", {
        name: "Rendang", visibility: "public",
      }, author.cookies[0]);
      const started = await call(base, "POST", "/api/cook-sessions", {
        recipeId: created.body.id,
      }, author.cookies[0]);
      expect(started.status).toBe(201);
      expect(started.body.id).toBeTruthy();
      expect(db.sessions).toHaveLength(1);
      expect(db.sessions[0].recipe_id).toBe(created.body.id);
      expect(sentButtons).toHaveLength(1);
      expect(sentButtons[0].to).toBe("62812");
      expect(sentButtons[0].opts.payload).toBe(`cook:${started.body.id}`);
    });
  });

  it("cook-sessions: rejects without wa number, anon, unknown recipe", async () => {
    await withApi(async (base) => {
      const author = await call(base, "POST", "/api/register", {
        email: "nowa@x.id", password: "rahasia123", role: "author",
      });
      const created = await call(base, "POST", "/api/recipes", {
        name: "Soto",
      }, author.cookies[0]);
      const noWa = await call(base, "POST", "/api/cook-sessions", {
        recipeId: created.body.id,
      }, author.cookies[0]);
      expect(noWa.status).toBe(400);

      const anon = await call(base, "POST", "/api/cook-sessions", { recipeId: "x" });
      expect(anon.status).toBe(401);

      const unknown = await call(base, "POST", "/api/cook-sessions", {
        recipeId: "nope",
      }, author.cookies[0]);
      expect(unknown.status).toBe(404);
      expect(sentButtons).toHaveLength(0);
    });
  });
});
