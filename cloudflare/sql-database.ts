import type { SqlDatabase, SqlValue } from "../server/sql-database";

export class DurableSqlDatabase implements SqlDatabase {
  constructor(private readonly storage: DurableObjectStorage) {}

  query<Row = unknown, Params extends SqlValue[] = SqlValue[]>(sql: string) {
    // Consume cursors synchronously so no read escapes the transaction snapshot.
    const all = (...bindings: Params): Row[] =>
      this.storage.sql.exec(sql, ...bindings).toArray() as unknown as Row[];
    return {
      get: (...bindings: Params): Row | null => all(...bindings)[0] ?? null,
      all,
    };
  }

  run(sql: string, bindings: SqlValue[] = []): void {
    this.storage.sql.exec(sql, ...bindings).toArray();
  }

  transaction<Result>(callback: () => Result) {
    // Durable Objects serialize synchronous work. Both modes use the native
    // rollback boundary; SQL BEGIN/COMMIT is unsupported in this runtime.
    const execute = () => this.storage.transactionSync(callback);
    return { immediate: execute, deferred: execute };
  }
}
