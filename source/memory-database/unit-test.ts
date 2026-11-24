import { sql, type Generated } from "kysely";
import { expect, test } from "vitest";
import { createMemoryDatabase } from "@sharadox/database-web-library/memory-database";

interface Schema {
  note: { id: Generated<string>; text: string };
}

test("runs typed queries on a Postgres that lives in memory", async () => {
  const { database, close } = await createMemoryDatabase<Schema>();
  await sql`create table note (id uuid primary key default uuidv7(), text text not null)`.execute(database);
  await database.insertInto("note").values({ text: "first" }).execute();
  const rows = await database.selectFrom("note").select(["text"]).execute();
  expect(rows).toEqual([{ text: "first" }]);
  await close();
});

test("sends values as parameters, never as SQL", async () => {
  const { database, close } = await createMemoryDatabase<Schema>();
  await sql`create table note (id uuid primary key default uuidv7(), text text not null)`.execute(database);
  const attack = "x'); drop table note; --";
  await database.insertInto("note").values({ text: attack }).execute();
  const rows = await database.selectFrom("note").select(["text"]).where("text", "=", attack).execute();
  expect(rows).toEqual([{ text: attack }]);
  await close();
});

test("rolls a failed transaction back", async () => {
  const { database, close } = await createMemoryDatabase<Schema>();
  await sql`create table note (id uuid primary key default uuidv7(), text text not null)`.execute(database);
  await expect(
    database.transaction().execute(async (transaction) => {
      await transaction.insertInto("note").values({ text: "kept?" }).execute();
      throw new Error("stop");
    }),
  ).rejects.toThrow("stop");
  expect(await database.selectFrom("note").selectAll().execute()).toEqual([]);
  await close();
});

test("counts the rows a statement changed", async () => {
  const { database, close } = await createMemoryDatabase<Schema>();
  await sql`create table note (id uuid primary key default uuidv7(), text text not null)`.execute(database);
  await database
    .insertInto("note")
    .values([{ text: "a" }, { text: "b" }])
    .execute();
  const [result] = await database.updateTable("note").set({ text: "c" }).execute();
  expect(result?.numUpdatedRows).toBe(2n);
  await close();
});
