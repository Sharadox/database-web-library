import { expect, test } from "vitest";
import { readMigrations } from "@sharadox/database-web-library/migration-file";

const fixture = (name: string) => new URL(`../migration/test-fixture/${name}/`, import.meta.url);

test("reads the .sql files of a folder in order, by number", async () => {
  const migrations = await readMigrations(fixture("good"));
  expect(migrations.map(({ name }) => name)).toEqual(["0001-note", "0002-note-time"]);
  expect(migrations[1]?.sql).toContain("Notes; with a semicolon");
});

test("accepts a folder path as text", async () => {
  const migrations = await readMigrations(fixture("good").pathname);
  expect(migrations).toHaveLength(2);
});

test("refuses a file not named <four digits>-<kebab-case>.sql", async () => {
  await expect(readMigrations(fixture("bad-name"))).rejects.toMatchObject({ code: "invalid-name" });
});

test("refuses two files with the same number", async () => {
  await expect(readMigrations(fixture("duplicate"))).rejects.toMatchObject({ code: "duplicate" });
});
