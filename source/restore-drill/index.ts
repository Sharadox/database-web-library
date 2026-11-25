import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { sql } from "kysely";
import { decryptBackup } from "@sharadox/database-web-library/backup-encryption";
import { restorableSql } from "@sharadox/database-web-library/backup-dump";
import { tableCounts } from "@sharadox/database-web-library/database-backup";
import type { BackupManifest } from "@sharadox/database-web-library/database-backup/type";
import type { RestoreDrillOptions, RestoreDrillResult } from "@sharadox/database-web-library/restore-drill/type";

/**
 * Proves the newest backup can be restored: checks its SHA-256, decrypts and unpacks it, replays it into an empty
 * Postgres, and compares every table's rows with its manifest. Run it monthly; a backup never restored is a hope.
 *
 * @example
 * const memory = await createMemoryDatabase();
 * const result = await restoreDrill({ storage, key, into: memory.database });
 * if (!result.ok) process.exitCode = 1;
 */
export async function restoreDrill({ storage, key, into }: RestoreDrillOptions): Promise<RestoreDrillResult> {
  const manifests = (await storage.list("")).filter((name) => name.endsWith(".json"));
  const newest = manifests.at(-1);
  if (!newest) throw new Error("there is no backup to restore");
  const manifest = JSON.parse(new TextDecoder().decode(await storage.get(newest))) as BackupManifest;
  const sealed = await storage.get(manifest.file);
  if (createHash("sha256").update(sealed).digest("hex") !== manifest.sha256)
    throw new Error(`${manifest.file} doesn't match its checksum`);
  const dump = new TextDecoder().decode(gunzipSync(decryptBackup(sealed, key)));
  // A dump pg_dump made from our own database: replayed as it is, into a database used for nothing else.
  // eslint-disable-next-line @sharadox/database/no-raw-sql
  await sql.raw(restorableSql(dump)).execute(into);
  const restored = await tableCounts(into);
  const tables = Object.entries(manifest.tables)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([table, expected]) => ({ table, expected, restored: restored[table] ?? 0 }));
  return { ok: tables.every(({ expected, restored }) => expected === restored), createdAt: manifest.createdAt, tables };
}
