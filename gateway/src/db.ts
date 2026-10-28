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
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf-8");
    await db.query(sql, []);
  }
  return files;
}
