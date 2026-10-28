import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import {
  clearSessionCookieHeader,
  hashPassword,
  isHttps,
  sessionCookieHeader,
  sessionFromHeader,
  signSession,
  verifyPassword,
  verifySession,
} from "./auth.js";
import type { Db } from "./db.js";
import { asyncHandler } from "./http.js";
import type { Presign } from "./media.js";
import { createRateLimiter } from "./ratelimit.js";
import {
  sendCallButtonMessage,
  type CallButtonOptions,
  type WhatsAppCredentials,
} from "./whatsapp.js";

export interface ApiUser {
  id: string;
  email: string;
  role: string;
  displayName: string;
}

export interface ApiDeps {
  db: Db;
  sessionSecret: string;
  creds: WhatsAppCredentials;
  sendCallButton?: (to: string, opts: CallButtonOptions) => Promise<void>;
  presign?: Presign;
}

type AuthedRequest = Request & { user?: ApiUser };

async function loadUser(db: Db, userId: string): Promise<ApiUser | null> {
  const res = await db.query(
    "SELECT id, email, role, display_name FROM users WHERE id = $1",
    [userId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    role: String(row.role),
    displayName: String(row.display_name ?? ""),
  };
}

function publicUser(user: ApiUser): object {
  return { id: user.id, email: user.email, role: user.role, displayName: user.displayName };
}

interface IngredientInput {
  name?: unknown;
  amount_original?: unknown;
  amount_standardized?: unknown;
}

function toIngredients(input: unknown): object[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((i) => typeof (i as IngredientInput)?.name === "string")
    .map((i) => {
      const item = i as IngredientInput;
      return {
        name: String(item.name),
        amount_original: typeof item.amount_original === "string" ? item.amount_original : "",
        amount_standardized:
          typeof item.amount_standardized === "string" ? item.amount_standardized : "",
      };
    });
}

function toSteps(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((s) => typeof s === "string").map((s) => String(s));
}

function isValidEmail(email: unknown): boolean {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createApiRouter(deps: ApiDeps): Router {
  const { db, sessionSecret, creds, presign } = deps;
  const sendCallButton =
    deps.sendCallButton ?? ((to, opts) => sendCallButtonMessage(creds, to, opts));
  const allowLogin = createRateLimiter({ limit: 10, windowMs: 60_000 });
  const allowRegister = createRateLimiter({ limit: 5, windowMs: 60_000 });
  const router = Router();

  router.use(async (req: AuthedRequest, _res, next) => {
    try {
      const userId = verifySession(sessionFromHeader(req.header("cookie")), sessionSecret);
      req.user = userId ? ((await loadUser(db, userId)) ?? undefined) : undefined;
    } catch {
      req.user = undefined;
    }
    next();
  });

  router.post("/register", asyncHandler(async (req: Request, res: Response) => {
    if (!allowRegister(req.ip ?? "unknown")) {
      res.status(429).json({ error: "terlalu banyak percobaan, coba lagi nanti" });
      return;
    }
    const { email, password, displayName, role, waId } = req.body as {
      email?: unknown;
      password?: unknown;
      displayName?: unknown;
      role?: unknown;
      waId?: unknown;
    };
    if (!isValidEmail(email) || typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "email valid + password min 8 karakter" });
      return;
    }
    if (role !== undefined && role !== "author" && role !== "client") {
      res.status(400).json({ error: "role harus author atau client" });
      return;
    }
    const wa = typeof waId === "string" ? waId.replace(/\D/g, "") : "";
    if (wa && (wa.length < 8 || wa.length > 15)) {
      res.status(400).json({ error: "nomor WhatsApp tidak valid" });
      return;
    }
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "email sudah terdaftar" });
      return;
    }
    if (wa) {
      const taken = await db.query("SELECT id FROM users WHERE wa_id = $1", [wa]);
      if (taken.rows.length > 0) {
        res.status(409).json({ error: "nomor WhatsApp sudah tertaut" });
        return;
      }
    }
    const userId = randomUUID();
    const familyId = randomUUID();
    const memberId = randomUUID();
    const name = typeof displayName === "string" ? displayName : "";
    // families must exist before users: users.family_id is a FK to families(id).
    await db.query("INSERT INTO families (id, name) VALUES ($1, $2)", [
      familyId,
      `Keluarga ${name || email}`,
    ]);
    await db.query(
      "INSERT INTO users (id, email, wa_id, family_id, password_hash, role, display_name) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [userId, email, wa || null, familyId, await hashPassword(password), role ?? "client", name],
    );
    await db.query(
      "INSERT INTO members (id, family_id, wa_id, role, display_name) VALUES ($1, $2, NULL, $3, $4)",
      [memberId, familyId, "owner", name],
    );
    const user: ApiUser = {
      id: userId,
      email: String(email),
      role: String(role ?? "client"),
      displayName: name,
    };
    res.setHeader("Set-Cookie", sessionCookieHeader(signSession(userId, sessionSecret), isHttps(req)));
    res.status(201).json(publicUser(user));
  }));

  router.post("/login", asyncHandler(async (req: Request, res: Response) => {
    if (!allowLogin(req.ip ?? "unknown")) {
      res.status(429).json({ error: "terlalu banyak percobaan, coba lagi nanti" });
      return;
    }
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    const found = await db.query(
      "SELECT id, email, password_hash, role, display_name FROM users WHERE email = $1",
      [email],
    );
    const row = found.rows[0];
    if (!row || typeof password !== "string" || !(await verifyPassword(password, String(row.password_hash)))) {
      res.status(401).json({ error: "email atau password salah" });
      return;
    }
    const user: ApiUser = {
      id: String(row.id),
      email: String(row.email),
      role: String(row.role),
      displayName: String(row.display_name ?? ""),
    };
    res.setHeader("Set-Cookie", sessionCookieHeader(signSession(user.id, sessionSecret), isHttps(req)));
    res.json(publicUser(user));
  }));

  router.post("/logout", (req: Request, res: Response) => {
    res.setHeader("Set-Cookie", clearSessionCookieHeader(isHttps(req)));
    res.sendStatus(204);
  });

  router.get("/me", (req: AuthedRequest, res: Response) => {
    if (!req.user) {
      res.sendStatus(401);
      return;
    }
    res.json(publicUser(req.user));
  });

  router.get("/recipes", asyncHandler(async (req: AuthedRequest, res: Response) => {
    const mine = req.user?.id ?? "";
    const result = await db.query(
      `SELECT id, name, creator_name, family_name, region, visibility, author_user_id
       FROM recipes WHERE visibility = 'public' OR author_user_id = $1
       ORDER BY created_at DESC`,
      [mine],
    );
    res.json(
      result.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        creatorName: String(r.creator_name ?? ""),
        familyName: String(r.family_name ?? ""),
        region: String(r.region ?? ""),
        visibility: String(r.visibility),
        mine: r.author_user_id != null && String(r.author_user_id) === mine && mine !== "",
      })),
    );
  }));

  router.post("/recipes", asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.user) {
      res.sendStatus(401);
      return;
    }
    if (req.user.role !== "author") {
      res.status(403).json({ error: "hanya peran author yang bisa menulis resep" });
      return;
    }
    const body = req.body as { [key: string]: unknown };
    if (typeof body.name !== "string" || body.name.trim() === "") {
      res.status(400).json({ error: "nama resep wajib diisi" });
      return;
    }
    const visibility = body.visibility === "public" ? "public" : "private";
    const recipeId = randomUUID();
    const owner = await db.query("SELECT family_id FROM users WHERE id = $1", [req.user.id]);
    const familyId = owner.rows[0]?.family_id as string | undefined;
    if (!familyId) {
      res.status(500).json({ error: "keluarga pemilik tidak ditemukan" });
      return;
    }
    const member = await db.query(
      "SELECT id FROM members WHERE family_id = $1 AND wa_id IS NULL AND role = 'owner' LIMIT 1",
      [familyId],
    );
    let memberId = member.rows[0]?.id != null ? String(member.rows[0].id) : "";
    if (!memberId) {
      memberId = randomUUID();
      await db.query(
        "INSERT INTO members (id, family_id, wa_id, role, display_name) VALUES ($1, $2, NULL, $3, $4)",
        [memberId, familyId, "owner", req.user.displayName],
      );
    }
    await db.query(
      `INSERT INTO recipes
       (id, family_id, contributor_member_id, author_user_id, wa_message_id, name,
        creator_name, family_name, region, language, ingredients, steps, story,
        transcript, status, visibility)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, '', 'draft', $14)
       RETURNING id`,
      [
        recipeId,
        familyId,
        memberId,
        req.user.id,
        `web-${recipeId}`,
        String(body.name),
        typeof body.creatorName === "string" ? body.creatorName : req.user.displayName,
        typeof body.familyName === "string" ? body.familyName : "",
        typeof body.region === "string" ? body.region : "",
        typeof body.language === "string" ? body.language : "",
        JSON.stringify(toIngredients(body.ingredients)),
        JSON.stringify(toSteps(body.steps)),
        typeof body.story === "string" ? body.story : "",
        visibility,
      ],
    );
    res.status(201).json({ id: recipeId });
  }));

  router.get("/recipes/:id", asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await db.query(
      `SELECT id, name, creator_name, family_name, region, language, ingredients,
              steps, story, visibility, author_user_id
       FROM recipes WHERE id = $1`,
      [req.params.id],
    );
    const row = result.rows[0];
    const mine = !!req.user && row?.author_user_id != null && String(row.author_user_id) === req.user.id;
    if (!row || (String(row.visibility) !== "public" && !mine)) {
      res.sendStatus(404);
      return;
    }
    const media = await db.query(
      "SELECT id, storage_url FROM media_assets WHERE recipe_id = $1 AND kind = 'voice' ORDER BY created_at DESC LIMIT 1",
      [req.params.id],
    );
    res.json({
      id: String(row.id),
      name: String(row.name),
      creatorName: String(row.creator_name ?? ""),
      familyName: String(row.family_name ?? ""),
      region: String(row.region ?? ""),
      language: String(row.language ?? ""),
      ingredients: row.ingredients ?? [],
      steps: row.steps ?? [],
      story: String(row.story ?? ""),
      visibility: String(row.visibility),
      mine,
      hasVoice: media.rows.length > 0,
    });
  }));

  // The archived voice note lives in object storage; sign it on read so the
  // link never expires (unlike a presigned URL stored at upload time).
  router.get("/recipes/:id/voice", asyncHandler(async (req: AuthedRequest, res: Response) => {
    const found = await db.query(
      "SELECT visibility, author_user_id FROM recipes WHERE id = $1",
      [req.params.id],
    );
    const row = found.rows[0];
    const mine = !!req.user && row?.author_user_id != null && String(row.author_user_id) === req.user.id;
    if (!row || (String(row.visibility) !== "public" && !mine)) {
      res.sendStatus(404);
      return;
    }
    const media = await db.query(
      "SELECT id, storage_url FROM media_assets WHERE recipe_id = $1 AND kind = 'voice' ORDER BY created_at DESC LIMIT 1",
      [req.params.id],
    );
    const stored = media.rows[0]?.storage_url;
    if (typeof stored !== "string" || !stored) {
      res.sendStatus(404);
      return;
    }
    // Rows written before this change hold a (now dead) presigned URL.
    if (/^https?:\/\//.test(stored)) {
      res.redirect(302, stored);
      return;
    }
    if (!presign) {
      res.status(503).json({ error: "arsip audio belum dikonfigurasi" });
      return;
    }
    res.redirect(302, await presign(stored));
  }));

  const updateGuard = async (req: AuthedRequest, res: Response): Promise<string | null> => {
    if (!req.user) {
      res.sendStatus(401);
      return null;
    }
    const found = await db.query("SELECT author_user_id FROM recipes WHERE id = $1", [
      req.params.id,
    ]);
    const row = found.rows[0];
    if (!row || row.author_user_id == null || String(row.author_user_id) !== req.user.id) {
      res.sendStatus(404);
      return null;
    }
    return String(req.params.id);
  };

  router.put("/recipes/:id", asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = await updateGuard(req, res);
    if (!id) return;
    const body = req.body as { [key: string]: unknown };
    if (typeof body.name !== "string" || body.name.trim() === "") {
      res.status(400).json({ error: "nama resep wajib diisi" });
      return;
    }
    const visibility = body.visibility === "public" ? "public" : "private";
    await db.query(
      `UPDATE recipes SET name = $1, creator_name = $2, family_name = $3, region = $4,
              language = $5, ingredients = $6::jsonb, steps = $7::jsonb, story = $8,
              visibility = $9, updated_at = now() WHERE id = $10`,
      [
        String(body.name),
        typeof body.creatorName === "string" ? body.creatorName : "",
        typeof body.familyName === "string" ? body.familyName : "",
        typeof body.region === "string" ? body.region : "",
        typeof body.language === "string" ? body.language : "",
        JSON.stringify(toIngredients(body.ingredients)),
        JSON.stringify(toSteps(body.steps)),
        typeof body.story === "string" ? body.story : "",
        visibility,
        id,
      ],
    );
    res.json({ id });
  }));

  router.delete("/recipes/:id", asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = await updateGuard(req, res);
    if (!id) return;
    await db.query("DELETE FROM recipes WHERE id = $1", [id]);
    res.sendStatus(204);
  }));

  router.post("/cook-sessions", asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.user) {
      res.sendStatus(401);
      return;
    }
    const { recipeId } = req.body as { recipeId?: unknown };
    if (typeof recipeId !== "string" || !recipeId) {
      res.status(400).json({ error: "recipeId wajib diisi" });
      return;
    }
    const found = await db.query(
      `SELECT id, name, visibility, author_user_id FROM recipes WHERE id = $1`,
      [recipeId],
    );
    const row = found.rows[0];
    const mine =
      !!row && row.author_user_id != null && String(row.author_user_id) === req.user.id;
    if (!row || (String(row.visibility) !== "public" && !mine)) {
      res.sendStatus(404);
      return;
    }
    const owner = await db.query("SELECT wa_id FROM users WHERE id = $1", [req.user.id]);
    const wa = owner.rows[0]?.wa_id != null ? String(owner.rows[0].wa_id) : "";
    if (!wa) {
      res.status(400).json({ error: "tautkan nomor WhatsApp dulu sebelum masak via call" });
      return;
    }
    const sessionId = randomUUID();
    await db.query(
      `INSERT INTO call_sessions (id, user_id, wa_caller, recipe_id, cta_payload, status, direction)
       VALUES ($1, $2, $3, $4, $5, 'pending', 'USER_INITIATED')`,
      [sessionId, req.user.id, wa, recipeId, `cook:${sessionId}`],
    );
    try {
      await sendCallButton(wa, {
        bodyText: `Tekan tombol untuk mulai masak ${String(row.name)} dipandu suara.`,
        displayText: "Masak via Call",
        ttlMinutes: 60,
        payload: `cook:${sessionId}`,
      });
    } catch (err) {
      console.error("call button send failed", err);
      res.status(502).json({ error: "gagal mengirim tombol call, coba lagi" });
      return;
    }
    res.status(201).json({ id: sessionId });
  }));

  return router;
}
