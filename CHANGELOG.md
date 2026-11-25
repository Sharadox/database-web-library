# Changelog

What changed in each version of `@sharadox/database-web-library`, newest first.

## 0.1.1

Backups and restore drills: encrypted pg_dump backups to an S3 bucket with Object Lock, and a monthly drill restoring the newest into Postgres in memory.

## 0.1.0

First version:

- `createDatabase`: Kysely over a Neon pool.
- `readDatabaseConfiguration`: reads `DATABASE_URL`.
- `migrate` and `readMigrations`: forward-only SQL migrations, for a database typed by any schema.
- `MigrationError`.
- `createMemoryDatabase` and `pglitePool`: Postgres in memory for tests.
- The `no-raw-sql` ESLint rule.
- Migration records have a UUIDv7 `id` primary key, added to record tables made before it.
- Backups and restore drills: `dumpDatabase`, `restorableSql`, `encryptBackup`, `decryptBackup`, `backupDatabase`,
  `tableCounts`, `restoreDrill`, `createBackupStorage`, `createMemoryBackupStorage`, `gitHubWebIdentityToken` and
  `runBackupCommand`.
