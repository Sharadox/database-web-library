import type { BackupStorage } from "@sharadox/database-web-library/backup-storage/type";

/**
 * Backup storage in memory, for tests and trying the backup locally: `files` shows what was stored.
 *
 * @example
 * const storage = createMemoryBackupStorage();
 * await backupDatabase({ dump, counts, storage, key });
 */
export function createMemoryBackupStorage(): BackupStorage & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    put: async (name, bytes) => void files.set(name, bytes),
    get: async (name) => {
      const bytes = files.get(name);
      if (!bytes) throw new Error(`no backup file "${name}"`);
      return bytes;
    },
    list: async (prefix) => [...files.keys()].filter((name) => name.startsWith(prefix)).sort(),
  };
}
