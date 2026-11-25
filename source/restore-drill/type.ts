import type { Kysely } from "kysely";
import type { BackupStorage } from "@sharadox/database-web-library/backup-storage/type";

export interface RestoreDrillOptions {
  storage: BackupStorage;
  /** `BACKUP_ENCRYPTION_KEY`. */
  key: string;
  /** An empty database to restore into (`createMemoryDatabase()`: Postgres 18 in memory). */
  into: Kysely<unknown>;
}

/** Whether the newest backup came back whole: every table with the rows its manifest promised. */
export interface RestoreDrillResult {
  ok: boolean;
  createdAt: string;
  tables: { table: string; expected: number; restored: number }[];
}
