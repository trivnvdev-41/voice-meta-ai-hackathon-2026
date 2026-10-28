import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Db, DbRow } from "../src/db.js";
import { migrate } from "../src/db.js";

class MigrationDb implements Db {
  applied = new Set<string>();
  queries: string[] = [];

  async query(text: string, params: unknown[]): Promise<{ rows: DbRow[]; rowCount: number }> {
    this.queries.push(text);
    if (text.includes("FROM schema_migrations WHERE filename")) {
      return { rows: this.applied.has(String(params[0])) ? [{ "?column?": 1 }] : [], rowCount: 0 };
    }
    const marker = /INSERT INTO schema_migrations \(filename\) VALUES \('([^']+)'\)/.exec(text);
    if (marker) this.applied.add(marker[1]);
    return { rows: [], rowCount: 0 };
  }
}

function sqlDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "grv-migrate-"));
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
}

describe("migrate", () => {
  it("applies each file once and records it", async () => {
    const dir = sqlDir({ "001_a.sql": "CREATE TABLE a (id int);", "002_b.sql": "CREATE TABLE b (id int);" });
    const db = new MigrationDb();

    expect(await migrate(db, dir)).toEqual(["001_a.sql", "002_b.sql"]);
    expect([...db.applied]).toEqual(["001_a.sql", "002_b.sql"]);

    expect(await migrate(db, dir)).toEqual([]);
    expect(db.queries.filter((q) => q.includes("CREATE TABLE a"))).toHaveLength(1);
  });

  it("ignores names that could break the marker insert", async () => {
    const dir = sqlDir({ "evil'name.sql": "CREATE TABLE x (id int);", "001_ok.sql": "CREATE TABLE y (id int);" });
    const db = new MigrationDb();
    expect(await migrate(db, dir)).toEqual(["001_ok.sql"]);
  });
});
