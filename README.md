# @sharadox/database-web-library

Typed, injection-safe Postgres for web applications: [Kysely](https://kysely.dev) queries over a
[Neon](https://neon.tech) pool, forward-only SQL migrations, a Postgres in memory for tests, and a lint rule that keeps
values out of SQL text.

- **Typed:** queries are checked against the schema's TypeScript types.
- **No SQL injection by construction:** values always travel as bound parameters. The `no-raw-sql` ESLint rule
  reports the few calls that could send unchecked text (`sql.raw`, `sql.lit`, `.unsafe()`, SQL built with `+` or
  `${…}`).
- **Migrations:** plain `.sql` files, run forward only, all or none, behind a lock, refused when an applied one was
  edited, removed or overtaken.
- **Tests without a server:** `createMemoryDatabase()` is a real Postgres 18 in memory (PGlite).

## Install

```sh
pnpm add @sharadox/database-web-library
pnpm add -D @electric-sql/pglite   # for createMemoryDatabase in tests
```

## Configuration

| Variable       | Meaning                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | `postgresql://…` address (set by Vercel's Neon integration). A secret: it holds a password. |

## API

Each export has its own entry point (`@sharadox/database-web-library/<name>`).

### `database`: `createDatabase<Schema>({ connectionString })` → `Kysely<Schema>`

The production database over a Neon pool. Nothing connects until the first query.

```ts
import { createDatabase } from "@sharadox/database-web-library/database";
import { readDatabaseConfiguration } from "@sharadox/database-web-library/database-configuration";

const database = createDatabase<Schema>(readDatabaseConfiguration());
const account = await database.selectFrom("account").selectAll().where("id", "=", id).executeTakeFirst();
```

### `database-configuration`: `readDatabaseConfiguration(environment = process.env)` → `{ connectionString }`

Reads `DATABASE_URL`, which must start with `postgres://` or `postgresql://`. The error names the variable, never its
value.

### `migration`: `migrate(database, migrations, { table = "schema_migration" })` → names applied

Applies, in order and in one transaction, the migrations not applied yet. Each is recorded with a SHA-256 of its
SQL, under a UUIDv7 `id` like every other row (a record table made before ids gets one). Throws `MigrationError` with one of these codes:

- `changed`: an applied migration was edited;
- `missing`: an applied migration was removed;
- `out-of-order`: a new migration is numbered before one already applied;
- `invalid-name`: the record table's name isn't plain.

### `migration-file`: `readMigrations(folder: URL | string)` → `Migration[]`

Reads `<four digits>-<kebab-case>.sql` files in number order and ignores other files. A badly named `.sql` file is
refused with `invalid-name`, a repeated number with `duplicate`.

```ts
import { migrate } from "@sharadox/database-web-library/migration";
import { readMigrations } from "@sharadox/database-web-library/migration-file";

await migrate(database, await readMigrations(new URL("../../migration/", import.meta.url)));
```

### `migration-error`: `MigrationError`

`{ name: "MigrationError", code, message }`, with `code` one of `invalid-name`, `duplicate`, `changed`, `missing` or
`out-of-order`.

### `memory-database`: `createMemoryDatabase<Schema>()` → `{ database, close }`

A fresh, empty Postgres 18 in memory, behind the same Kysely, for unit tests. It needs `@electric-sql/pglite`.

```ts
const { database, close } = await createMemoryDatabase<Schema>();
await migrate(database, await readMigrations(new URL("../migration/", import.meta.url)));
// … test …
await close();
```

### `pglite-pool`: `pglitePool(pglite)` → Kysely `PostgresPool`

The adapter `createMemoryDatabase` uses. It hands out one connection at a time, and a query without parameters may
hold several statements.

### `es-lint-plugin`: `databaseEsLintPlugin`, `noRawSql`

```js
// eslint.config.mjs
import { nodeConfiguration } from "@sharadox/es-lint-configuration-web-library/node";
import { databaseEsLintPlugin } from "@sharadox/database-web-library/es-lint-plugin";

export default [...nodeConfiguration(), ...databaseEsLintPlugin.configs.recommended];
```

Rule `@sharadox/database/no-raw-sql` reports:

- `sql.raw()`, `sql.lit()`, `CompiledQuery.raw()` and any `.unsafe()`;
- a `.query()` whose SQL is built with `+` or a template with `${…}`.

Kysely's tagged ``sql`…${value}…` `` is allowed: its values are parameters.

## Ids

Use UUIDv7 ids, in a `uuid` column guarded by a check:

```sql
create table account (
  id uuid primary key default uuidv7() check (uuid_extract_version(id) = 7)
);
```

Generate them in code with `uuidVersion7` from `@sharadox/web-library` when the id is needed before the insert.

## Backups and restore drills

A daily, encrypted copy of the production database in an S3 bucket nobody can empty, and a monthly proof that it
restores. The pieces, usable on their own:

- `dumpDatabase(url, { program?, run? })` (`backup-dump`): `pg_dump` of the public schema as plain INSERTs, without
  owners or grants (needs `pg_dump` of the server's major version or later). The address goes in libpq's environment (`PGHOST`, `PGPASSWORD`…), never
  on the command line. `restorableSql(dump)` drops psql's own commands (`\restrict`) so any Postgres can replay it.
- `encryptBackup(bytes, key)`, `decryptBackup(bytes, key)` (`backup-encryption`): AES-256-GCM under
  `BACKUP_ENCRYPTION_KEY` (at least 32 characters, kept apart from the backups); any change is detected.
- `backupDatabase({ dump, counts, storage, key, now? })` (`database-backup`): gzip, encrypt, store
  `YYYY/MM/DD/<time>.sql.gz.enc` and its manifest `<time>.json` (time, size, SHA-256, rows per table).
  `tableCounts(database)` gives the rows per table.
- `restoreDrill({ storage, key, into })` (`restore-drill`): the newest backup, checked against its SHA-256,
  decrypted, replayed into an empty database (`createMemoryDatabase()`), and every table's rows compared with the
  manifest → `{ ok, createdAt, tables: [{ table, expected, restored }] }`.
- `createBackupStorage({ bucket, region, prefix, credentials })` (`backup-storage`): S3, write, read and list only;
  the bucket's Object Lock (compliance mode, 35 days) keeps every file unchangeable. `createMemoryBackupStorage()`
  for tests.
- `gitHubWebIdentityToken()` (`git-hub-web-identity`): the GitHub Actions job's identity token for AWS, so the job
  takes an IAM role with no stored key (the job needs `permissions: { id-token: write }`).
- `runBackupCommand("backup" | "drill")` (`backup-command`): what a site's workflow runs, reading `BACKUP_BUCKET`,
  `BACKUP_REGION`, `BACKUP_PREFIX`, `BACKUP_ROLE`, `BACKUP_ENCRYPTION_KEY` and, for a backup,
  `DATABASE_BACKUP_URL` (a read-only role). It returns the exit code:

```sh
node -e 'import("@sharadox/database-web-library/backup-command").then(async (m) => process.exit(await m.runBackupCommand("backup")))'
```

## License

Sharadox Open Source License 0.1.0 (see `LICENSE.md`).
