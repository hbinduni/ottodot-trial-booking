import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";

export function openDatabase(filename: string): Database {
  const db = new Database(filename, { create: true, strict: true });
  db.exec(
    "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;",
  );
  return db;
}

export function migrate(db: Database): void {
  db.transaction(() => {
    const version = db
      .query<{ user_version: number }, []>("PRAGMA user_version")
      .get()?.user_version;
    if (version === 1) return;
    if (version !== 0)
      throw new Error(`Unsupported schema version: ${version}`);
    db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
    db.exec("PRAGMA user_version = 1");
  }).immediate();
}
