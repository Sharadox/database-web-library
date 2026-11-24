import { PGlite } from "@electric-sql/pglite";
import { Kysely, PostgresDialect } from "kysely";
import { pglitePool } from "@sharadox/database-web-library/pglite-pool";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";

/**
 * A fresh, empty Postgres 18 in memory (PGlite), behind the same Kysely as production: for unit tests of anything
 * that uses a database, with no server, network or cost. Needs `@electric-sql/pglite` installed (a development
 * dependency is enough).
 *
 * @example
 * const { database, close } = await createMemoryDatabase<Schema>();
 * await migrate(database, await readMigrations(new URL("../migration/", import.meta.url)));
 * // … test …
 * await close();
 */
export async function createMemoryDatabase<Schema>(): Promise<MemoryDatabase<Schema>> {
  const pglite = await PGlite.create();
  const database = new Kysely<Schema>({ dialect: new PostgresDialect({ pool: pglitePool(pglite) }) });
  return { database, close: () => database.destroy() };
}
