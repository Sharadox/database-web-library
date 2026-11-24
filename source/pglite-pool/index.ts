import type { PGlite, Results } from "@electric-sql/pglite";
import type { PostgresPool, PostgresPoolClient, PostgresQueryResult } from "kysely";

type Command = PostgresQueryResult<unknown>["command"];

/** The shape node-postgres gives a result, from PGlite's own. */
function asPostgresResult<R>(result: Results<R> & { command?: string; rowCount?: number }): PostgresQueryResult<R> {
  return {
    command: (result.command ?? "SELECT") as Command,
    rowCount: result.rowCount ?? result.rows.length,
    rows: result.rows,
  };
}

/**
 * A Kysely `PostgresPool` over one PGlite database (Postgres compiled to WebAssembly, in the same process), for tests
 * and local work without a server. PGlite has a single connection, so connections are handed out one at a time, in
 * the order asked. A query without parameters may hold several statements, as with node-postgres (Postgres's simple
 * protocol); the result is the last statement's.
 *
 * @example
 * import { PGlite } from "@electric-sql/pglite";
 * import { Kysely, PostgresDialect } from "kysely";
 * const database = new Kysely<Schema>({ dialect: new PostgresDialect({ pool: pglitePool(new PGlite()) }) });
 */
export function pglitePool(pglite: PGlite): PostgresPool {
  let queue: Promise<void> = Promise.resolve();
  const client = (release: () => void): PostgresPoolClient =>
    ({
      async query<R>(sql: unknown, parameters?: ReadonlyArray<unknown>) {
        if (typeof sql !== "string") throw new Error("pglitePool: streaming is not supported");
        if (parameters && parameters.length > 0)
          return asPostgresResult<R>(await pglite.query<R>(sql, [...parameters]));
        const results = await pglite.exec(sql);
        return asPostgresResult<R>(results.at(-1) as Results<R>);
      },
      release,
    }) as PostgresPoolClient;
  return {
    connect() {
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      const turn = queue.then(() => client(release));
      queue = queue.then(() => released);
      return turn;
    },
    end: () => pglite.close(),
  };
}
