import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { sql } from "kysely";
import { afterEach, beforeEach, expect, test } from "vitest";
import { decryptBackup } from "@sharadox/database-web-library/backup-encryption";
import { backupDatabase, tableCounts } from "@sharadox/database-web-library/database-backup";
import { createMemoryBackupStorage as memoryStorage } from "@sharadox/database-web-library/memory-backup-storage";
import { createMemoryDatabase } from "@sharadox/database-web-library/memory-database";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";

const key = "a-backup-key-of-at-least-thirty-two-characters";
let memory: MemoryDatabase<unknown>;
beforeEach(async () => (memory = await createMemoryDatabase()));
afterEach(() => memory.close());

test("counts the rows of every table in the public schema", async () => {
  await sql`create table note (id int); insert into note values (1), (2); create table empty (id int);`.execute(
    memory.database,
  );
  expect(await tableCounts(memory.database)).toEqual({ empty: 0, note: 2 });
});

test("stores the dump compressed and encrypted, with a manifest of its tables, under the day it was made", async () => {
  const storage = memoryStorage();
  const dump = await readFile(new URL("../restore-drill/test-fixture/dump.sql", import.meta.url));
  const result = await backupDatabase({
    dump: async () => new Uint8Array(dump),
    counts: async () => ({ note: 2, tag: 1 }),
    storage,
    key,
    now: Date.UTC(2026, 10, 25, 3, 17, 5),
  });
  expect(result.file).toBe("2026/11/25/2026-11-25T03-17-05Z.sql.gz.enc");
  expect([...storage.files.keys()]).toEqual([result.file, "2026/11/25/2026-11-25T03-17-05Z.json"]);
  const sealed = storage.files.get(result.file)!;
  expect(gunzipSync(decryptBackup(sealed, key)).toString()).toBe(dump.toString());
  const manifest = JSON.parse(new TextDecoder().decode(storage.files.get("2026/11/25/2026-11-25T03-17-05Z.json")));
  expect(manifest).toEqual({
    createdAt: "2026-11-25T03:17:05.000Z",
    file: result.file,
    bytes: sealed.length,
    sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    tables: { note: 2, tag: 1 },
  });
  expect(result.tables).toEqual({ note: 2, tag: 1 });
});

test("uses the current time by default", async () => {
  const storage = memoryStorage();
  const result = await backupDatabase({ dump: async () => new Uint8Array(), counts: async () => ({}), storage, key });
  expect(result.file.slice(0, 4)).toBe(String(new Date().getUTCFullYear()));
});
