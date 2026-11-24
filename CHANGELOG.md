# Changelog

What changed in each version of `@sharadox/database-web-library`, newest first.

## 0.1.0

First version:

- `createDatabase`: Kysely over a Neon pool.
- `readDatabaseConfiguration`: reads `DATABASE_URL`.
- `migrate` and `readMigrations`: forward-only SQL migrations.
- `MigrationError`.
- `createMemoryDatabase` and `pglitePool`: Postgres in memory for tests.
- The `no-raw-sql` ESLint rule.
