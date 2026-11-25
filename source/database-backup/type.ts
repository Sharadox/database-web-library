import type { BackupStorage } from "@sharadox/database-web-library/backup-storage/type";

export interface BackupOptions {
  /** Makes the plain SQL dump (`dumpDatabase`). */
  dump: () => Promise<Uint8Array>;
  /** Rows per table at the time of the dump (`tableCounts`), which the restore drill checks. */
  counts: () => Promise<Record<string, number>>;
  storage: BackupStorage;
  /** `BACKUP_ENCRYPTION_KEY`: at least 32 characters, kept apart from the backups. */
  key: string;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

/** What a backup wrote: its file, and the rows it holds per table. */
export interface BackupResult {
  file: string;
  manifest: string;
  tables: Record<string, number>;
}

/** Stored beside each backup file. */
export interface BackupManifest {
  createdAt: string;
  file: string;
  bytes: number;
  /** Of the encrypted file. */
  sha256: string;
  tables: Record<string, number>;
}
