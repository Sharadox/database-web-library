import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { sql, type Kysely } from "kysely";
import { encryptBackup } from "@sharadox/database-web-library/backup-encryption";
import type { BackupManifest, BackupOptions, BackupResult } from "@sharadox/database-web-library/database-backup/type";

/**
 * Rows per table in the public schema, for the backup's manifest and the restore drill's check. Table names come
 * from the catalog and are quoted as identifiers.
 *
 * @example
 * await tableCounts(database); // { account: 12, contact: 14, … }
 */
export async function tableCounts<Schema>(database: Kysely<Schema>): Promise<Record<string, number>> {
  const tables = await sql<{ name: string }>`select tablename as name from pg_tables
    where schemaname = 'public' order by tablename`.execute(database);
  const counts: Record<string, number> = {};
  for (const { name } of tables.rows) {
    // Schema-qualified: a replayed dump leaves the session with an empty search path.
    const { rows } = await sql<{ count: string }>`select count(*) as count from ${sql.table(`public.${name}`)}`.execute(
      database,
    );
    counts[name] = Number(rows[0]!.count);
  }
  return counts;
}

/**
 * Makes one backup: the dump, compressed (gzip) and encrypted (AES-256-GCM), stored as
 * `YYYY/MM/DD/<time>.sql.gz.enc` with a manifest beside it (`<time>.json`: when, size, SHA-256 and rows per table).
 * The bucket's Object Lock then keeps it, unchangeable, for its retention (35 days).
 *
 * @example
 * await backupDatabase({ dump: () => dumpDatabase(url), counts: () => tableCounts(database), storage, key });
 */
export async function backupDatabase({
  dump,
  counts,
  storage,
  key,
  now = Date.now(),
}: BackupOptions): Promise<BackupResult> {
  const created = new Date(now);
  const tables = await counts();
  const sealed = encryptBackup(gzipSync(await dump()), key);
  const day = created.toISOString().slice(0, 10).replaceAll("-", "/");
  const name = `${day}/${created.toISOString().slice(0, 19).replaceAll(":", "-")}Z`;
  const file = `${name}.sql.gz.enc`;
  const manifest: BackupManifest = {
    createdAt: created.toISOString(),
    file,
    bytes: sealed.length,
    sha256: createHash("sha256").update(sealed).digest("hex"),
    tables,
  };
  await storage.put(file, sealed, "application/octet-stream");
  await storage.put(`${name}.json`, new TextEncoder().encode(JSON.stringify(manifest, null, 2)), "application/json");
  return { file, manifest: `${name}.json`, tables };
}
