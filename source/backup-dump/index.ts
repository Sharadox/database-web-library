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
 * included, can replay it), without owners or grants. The address goes in the environment (`PGDATABASE`), never on
 * the command line, so the password isn't visible in the process list.
 *
 * @example
 * const sql = await dumpDatabase(process.env.DATABASE_BACKUP_URL!);
 */
export async function dumpDatabase(
  databaseUrl: string,
  { program = "pg_dump", run = runProgram }: DumpOptions = {},
): Promise<Uint8Array> {
  return run(program, ["--schema=public", "--inserts", "--no-owner", "--no-privileges", "--quote-all-identifiers"], {
    PGDATABASE: databaseUrl,
  });
}

/**
 * A dump without psql's own commands (`\restrict`, `\unrestrict`, which pg_dump 18 adds), so it runs as plain SQL.
 *
 * @example
 * await sql.raw(restorableSql(text)).execute(database);
 */
export function restorableSql(dump: string): string {
  return dump
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n");
}
