import { sql } from "kysely";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createMemoryDatabase } from "@sharadox/database-web-library/memory-database";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import { migrate } from "@sharadox/database-web-library/migration";

const note = {
  name: "0001-note",
  sql: "create table note (id uuid primary key default uuidv7(), text text not null);",
};
const time = { name: "0002-note-time", sql: "alter table note add column at timestamptz; select 1;" };

let memory: MemoryDatabase<unknown>;
beforeEach(async () => (memory = await createMemoryDatabase()));
afterEach(() => memory.close());

const tables = async () =>
  (
    await sql<{
      name: string;
    }>`select table_name as name from information_schema.tables where table_schema = 'public' order by 1`.execute(
      memory.database,
    )
  ).rows.map(({ name }) => name);

test("applies the migrations not applied yet, in order, and remembers them", async () => {
  expect(await migrate(memory.database, [note, time])).toEqual(["0001-note", "0002-note-time"]);
  expect(await tables()).toEqual(["note", "schema_migration"]);
  expect(await migrate(memory.database, [note, time])).toEqual([]);
});

test("applies only the new ones on a later run", async () => {
  await migrate(memory.database, [note]);
  expect(await migrate(memory.database, [note, time])).toEqual(["0002-note-time"]);
});

test("applies nothing when one fails: all or none", async () => {
  const broken = { name: "0002-broken", sql: "alter table missing add column x int;" };
  await expect(migrate(memory.database, [note, broken])).rejects.toThrow();
  expect(await tables()).toEqual([]);
});

test("refuses a migration changed after it was applied", async () => {
  await migrate(memory.database, [note]);
  await expect(migrate(memory.database, [{ ...note, sql: note.sql + " -- edited" }])).rejects.toMatchObject({
    code: "changed",
  });
});

test("refuses when an applied migration is no longer there", async () => {
  await migrate(memory.database, [note, time]);
  await expect(migrate(memory.database, [note])).rejects.toMatchObject({ code: "missing" });
});

test("refuses a new migration numbered before one already applied", async () => {
  await migrate(memory.database, [note, time]);
  const late = { name: "0001-late", sql: "select 1;" };
  await expect(migrate(memory.database, [late, note, time])).rejects.toMatchObject({ code: "out-of-order" });
});

test("keeps its records in the table it is given", async () => {
  await migrate(memory.database, [note], { table: "applied_change" });
  expect(await tables()).toEqual(["applied_change", "note"]);
});

test("refuses a record table name that isn't a plain lowercase identifier", async () => {
  await expect(migrate(memory.database, [note], { table: "x; drop table note" })).rejects.toMatchObject({
    code: "invalid-name",
  });
});

test("applies a folder's files, and Postgres then refuses any id that isn't a UUIDv7", async () => {
  const { readMigrations } = await import("@sharadox/database-web-library/migration-file");
  await migrate(memory.database, await readMigrations(new URL("test-fixture/good/", import.meta.url)));
  await sql`insert into note (text) values (${"made by uuidv7()"})`.execute(memory.database);
  await expect(
    sql`insert into note (id, text) values (${"7d444840-9dc0-41d6-8f34-1aa6c1f2f0d9"}, ${"version 4"})`.execute(
      memory.database,
    ),
  ).rejects.toThrow(/check constraint/);
});

test("takes a database typed by its schema, as applications have them", async () => {
  const typed = await createMemoryDatabase<{ note: { id: string; text: string } }>();
  expect(await migrate(typed.database, [note])).toEqual(["0001-note"]);
  await typed.database
    .insertInto("note")
    .values({ id: "0198f5a2-7a4c-7000-8000-000000000001", text: "hello" })
    .execute();
  await typed.close();
});

const recordIds = async (table: string) =>
  (
    await sql<{ version: number; key: string }>`select uuid_extract_version(id) as version,
      (select string_agg(attname, ',') from pg_index join pg_attribute on attrelid = indrelid and attnum = any(indkey)
        where indrelid = ${table}::regclass and indisprimary) as key
      from ${sql.table(table)}`.execute(memory.database)
  ).rows;

test("gives every record a UUIDv7 id, its primary key", async () => {
  await migrate(memory.database, [note, time]);
  expect(await recordIds("schema_migration")).toEqual([
    { version: 7, key: "id" },
    { version: 7, key: "id" },
  ]);
  await expect(
    sql`insert into schema_migration (id, name, checksum) values (${"7d444840-9dc0-41d6-8f34-1aa6c1f2f0d9"}, ${"x"}, ${"y"})`.execute(
      memory.database,
    ),
  ).rejects.toThrow(/check constraint/);
});

test("adds the id to a record table made before ids, keeping names unique", async () => {
  await sql`create table schema_migration (name text primary key, checksum text not null,
    applied_at timestamptz not null default now())`.execute(memory.database);
  await migrate(memory.database, [note]);
  expect(await migrate(memory.database, [note, time])).toEqual(["0002-note-time"]);
  expect(await recordIds("schema_migration")).toEqual([
    { version: 7, key: "id" },
    { version: 7, key: "id" },
  ]);
  await expect(
    sql`insert into schema_migration (name, checksum) values (${"0001-note"}, ${"y"})`.execute(memory.database),
  ).rejects.toThrow(/unique/);
});
