import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import { MigrationError } from "@sharadox/database-web-library/migration-error";
import type { MigrateOptions, Migration } from "@sharadox/database-web-library/migration/type";

/** A table name `migrate` accepts: plain lowercase, so it never needs quoting. */
const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

/** Record tables made before every row had an id get one: a UUIDv7 primary key, with names kept unique. */
async function addRecordIds<Schema>(transaction: Kysely<Schema>, table: string): Promise<void> {
  const { rows } = await sql`select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = ${table} and column_name = ${"id"}`.execute(transaction);
  if (rows.length > 0) return;
  const records = sql.table(table);
  await sql`alter table ${records} drop constraint ${sql.id(`${table}_pkey`)}`.execute(transaction);
  await sql`alter table ${records} add constraint ${sql.id(`${table}_name_key`)} unique (name)`.execute(transaction);
  await sql`alter table ${records}
    add column id uuid primary key default uuidv7() check (uuid_extract_version(id) = 7)`.execute(transaction);
}

const checksum = (text: string) => createHash("sha256").update(text).digest("hex");

/**
 * Brings a database up to date: applies, in order, the migrations it hasn't applied yet, all in one transaction (all
 * or none) behind a lock (two deployments never migrate at once), and records each with a checksum of its SQL.
 * Forward only: it refuses (`MigrationError`) when an applied migration was edited or removed, or a new one is
 * numbered before one already applied. Returns the names it applied.
 *
 * @example
 * const applied = await migrate(database, await readMigrations(new URL("../../migration/", import.meta.url)));
 */
export async function migrate<Schema>(
  database: Kysely<Schema>,
  migrations: Migration[],
  { table = "schema_migration" }: MigrateOptions = {},
): Promise<string[]> {
  if (!IDENTIFIER.test(table)) throw new MigrationError("invalid-name", `"${table}" is not a plain table name`);
  const records = sql.table(table);
  return database.transaction().execute(async (transaction) => {
    await sql`select pg_advisory_xact_lock(hashtext(${table}))`.execute(transaction);
    await sql`create table if not exists ${records} (
      id uuid primary key default uuidv7() check (uuid_extract_version(id) = 7),
      name text not null unique,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`.execute(transaction);
    await addRecordIds(transaction, table);
    const applied = (
      await sql<{ name: string; checksum: string }>`select name, checksum from ${records} order by name`.execute(
        transaction,
      )
    ).rows;
    const known = new Map(migrations.map((migration) => [migration.name, migration]));
    for (const record of applied) {
      const migration = known.get(record.name);
      if (!migration) throw new MigrationError("missing", `${record.name} was applied but is no longer there`);
      if (checksum(migration.sql) !== record.checksum)
        throw new MigrationError("changed", `${record.name} was changed after it was applied`);
    }
    const done = new Set(applied.map(({ name }) => name));
    const last = applied.at(-1)?.name ?? "";
    const pending = migrations.filter(({ name }) => !done.has(name));
    for (const migration of pending) {
      if (migration.name < last)
        throw new MigrationError("out-of-order", `${migration.name} is numbered before ${last}, already applied`);
      // A migration file is SQL we wrote and reviewed, run as it is: the one place raw SQL is allowed.
      // eslint-disable-next-line @sharadox/database/no-raw-sql
      await sql.raw(migration.sql).execute(transaction);
      await sql`insert into ${records} (name, checksum) values (${migration.name}, ${checksum(migration.sql)})`.execute(
        transaction,
      );
    }
    return pending.map(({ name }) => name);
  });
}
