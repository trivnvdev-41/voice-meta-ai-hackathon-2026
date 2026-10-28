import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

export interface DbRow {
  [key: string]: any;
}

export interface DbResult {
  rows: DbRow[];
  rowCount: number;
}

export interface Db {
  query(text: string, params: unknown[]): Promise<DbResult>;
}

export function createDb(url: string): Db {
  const pool = new Pool({ connectionString: url });
  return {
    query: async (text, params) => {
      const res = await pool.query(text, params as any[]);
      return { rows: res.rows, rowCount: res.rowCount ?? 0 };
    },
  };
}

export async function migrate(db: Db, dir: string): Promise<string[]> {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && /^[A-Za-z0-9_.-]+$/.test(f))
    .sort();
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
    [],
  );
  const applied: string[] = [];
  for (const file of files) {
    const done = await db.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1",
      [file],
    );
    if (done.rows.length > 0) continue;
    const sql = readFileSync(join(dir, file), "utf-8");
    // One simple-protocol query is one implicit transaction: the schema change
    // and its marker commit (or roll back) together.
    await db.query(
      `${sql}\nINSERT INTO schema_migrations (filename) VALUES ('${file}');`,
      [],
    );
    applied.push(file);
  }
  return applied;
}
