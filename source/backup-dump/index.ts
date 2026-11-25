import { execFile } from "node:child_process";
import type { DumpOptions, ProgramRunner } from "@sharadox/database-web-library/backup-dump/type";

const runProgram: ProgramRunner = (program, parameters, environment) =>
  new Promise((resolve, reject) => {
    execFile(
      program,
      parameters,
      { env: { ...process.env, ...environment }, encoding: "buffer", maxBuffer: 1024 * 1024 * 1024 },
      (error, output) =>
        error ? reject(new Error(`${program} failed: ${error.message}`)) : resolve(new Uint8Array(output)),
    );
  });

/**
 * A plain SQL dump of the database's public schema, made by `pg_dump`: one INSERT per row (so any Postgres, PGlite
 * included, can replay it), without owners or grants. The address goes in libpq's environment (`PGHOST`, `PGUSER`,
 * `PGPASSWORD`…), never on the command line, so the password isn't visible in the process list.
 *
 * @example
 * const sql = await dumpDatabase(process.env.DATABASE_BACKUP_URL!);
 */
export async function dumpDatabase(
  databaseUrl: string,
  { program = "pg_dump", run = runProgram }: DumpOptions = {},
): Promise<Uint8Array> {
  const url = new URL(databaseUrl);
  return run(program, ["--schema=public", "--inserts", "--no-owner", "--no-privileges", "--quote-all-identifiers"], {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
    // Neon always speaks TLS; without a mode in the address, the certificate is checked too.
    PGSSLMODE: url.searchParams.get("sslmode") ?? "verify-full",
  });
}

/**
 * Statements only the source could run: creating the public schema (every Postgres has it) and Neon's internal column
 * option `pg_attver`, which other Postgres builds don't know.
 */
const SOURCE_ONLY =
  /^(CREATE SCHEMA "public";|COMMENT ON SCHEMA "public" IS .*;|ALTER TABLE ONLY .* SET \(pg_attver=\d+\);)$/;

/**
 * A dump without psql's own commands (`\restrict`, `\unrestrict`, which pg_dump 18 adds) and without creating the
 * public schema (which every Postgres has) or setting Neon's internal column options, so it runs as plain SQL in an
 * empty database.
 *
 * @example
 * await sql.raw(restorableSql(text)).execute(database);
 */
export function restorableSql(dump: string): string {
  return dump
    .split("\n")
    .filter((line) => !line.startsWith("\\") && !SOURCE_ONLY.test(line))
    .join("\n");
}
