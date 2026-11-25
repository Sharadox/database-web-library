import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, test } from "vitest";
import { backupDatabase } from "@sharadox/database-web-library/database-backup";
import { restoreDrill } from "@sharadox/database-web-library/restore-drill";
import { createMemoryDatabase } from "@sharadox/database-web-library/memory-database";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import { createMemoryBackupStorage as memoryStorage } from "@sharadox/database-web-library/memory-backup-storage";

const key = "a-backup-key-of-at-least-thirty-two-characters";
let into: MemoryDatabase<unknown>;
beforeEach(async () => (into = await createMemoryDatabase()));
afterEach(() => into.close());

const dump = async () => new Uint8Array(await readFile(new URL("test-fixture/dump.sql", import.meta.url)));

test("restores the newest backup into an empty Postgres and finds every row it should", async () => {
  const storage = memoryStorage();
  await backupDatabase({
    dump: async () => new TextEncoder().encode("select 1;"),
    counts: async () => ({}),
    storage,
    key,
    now: 0,
  });
  await backupDatabase({ dump, counts: async () => ({ note: 2, tag: 1 }), storage, key, now: Date.UTC(2026, 10, 25) });
  const result = await restoreDrill({ storage, key, into: into.database });
  expect(result).toEqual({
    ok: true,
    createdAt: "2026-11-25T00:00:00.000Z",
    tables: [
      { table: "note", expected: 2, restored: 2 },
      { table: "tag", expected: 1, restored: 1 },
    ],
  });
});

test("a missing or extra row, or a table gone, fails the drill", async () => {
  const storage = memoryStorage();
  await backupDatabase({ dump, counts: async () => ({ note: 3, tag: 1, gone: 4 }), storage, key, now: 0 });
  const result = await restoreDrill({ storage, key, into: into.database });
  expect(result.ok).toBe(false);
  expect(result.tables).toContainEqual({ table: "note", expected: 3, restored: 2 });
  expect(result.tables).toContainEqual({ table: "gone", expected: 4, restored: 0 });
});

test("refuses a changed file, and says when there is no backup at all", async () => {
  const storage = memoryStorage();
  const made = await backupDatabase({ dump, counts: async () => ({ note: 2, tag: 1 }), storage, key, now: 0 });
  const file = storage.files.get(made.file)!;
  file[file.length - 1]! ^= 1;
  await expect(restoreDrill({ storage, key, into: into.database })).rejects.toThrow(/checksum/);
  await expect(restoreDrill({ storage: memoryStorage(), key, into: into.database })).rejects.toThrow(/no backup/);
});
