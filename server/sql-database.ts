export type SqlValue = string | number | null;

// biome-ignore lint/suspicious/noExplicitAny: Match Bun's conditional tuple type for structural compatibility; values stay constrained to SqlValue.
type SqlParams<Params extends SqlValue[]> = Params extends any[]
  ? Params
  : [Params];

// The shared booking service needs synchronous SQL, bound values, and atomic transactions.
export interface SqlDatabase {
  query<Row = unknown, Params extends SqlValue[] = SqlValue[]>(
    sql: string,
  ): {
    get(...bindings: SqlParams<Params>): Row | null;
    all(...bindings: SqlParams<Params>): Row[];
  };
  run(sql: string): void;
  run(sql: string, bindings: SqlValue[]): void;
  transaction<Result>(callback: () => Result): {
    immediate(): Result;
    deferred(): Result;
  };
}
