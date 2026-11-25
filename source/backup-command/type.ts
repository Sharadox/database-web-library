import type { Kysely } from "kysely";
import type { BackupStorage } from "@sharadox/database-web-library/backup-storage/type";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";

/** Where a backup command's pieces come from (tests give their own). */
export interface BackupParts {
  storage: (options: { bucket: string; region: string; prefix: string; role: string }) => BackupStorage;
  database: (url: string) => Kysely<unknown>;
  dump: (url: string) => Promise<Uint8Array>;
  memory: () => Promise<MemoryDatabase<unknown>>;
  log: (line: string) => void;
}
