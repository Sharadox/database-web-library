import { Pool } from "@neondatabase/serverless";
import { Kysely, PostgresDialect } from "kysely";
import type { DatabaseConfiguration } from "@sharadox/database-web-library/database-configuration/type";

/**
 * The production database: Kysely, typed by the schema, over a Neon connection pool (Postgres over WebSockets, made
 * for serverless functions). Nothing connects until the first query. Every value goes to Postgres as a bound
 * parameter; see the `no-raw-sql` lint rule.
 *
 * @example
 * import { createDatabase } from "@sharadox/database-web-library/database";
 * import { readDatabaseConfiguration } from "@sharadox/database-web-library/database-configuration";
 * const database = createDatabase<Schema>(readDatabaseConfiguration());
 * const account = await database.selectFrom("account").selectAll().where("id", "=", id).executeTakeFirst();
 */
export function createDatabase<Schema>({ connectionString }: DatabaseConfiguration): Kysely<Schema> {
  return new Kysely<Schema>({ dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }) });
}
