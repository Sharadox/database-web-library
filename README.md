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

## License

Sharadox Open Source License 0.1.0 (see `LICENSE.md`).
