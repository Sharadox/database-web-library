import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MigrationError } from "@sharadox/database-web-library/migration-error";
import type { Migration } from "@sharadox/database-web-library/migration/type";

/** `0001-account.sql`: four digits, a kebab-case name. */
const FILE_NAME = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.sql$/;

/**
 * Reads a folder's migrations: every `.sql` file, named `<four digits>-<kebab-case>.sql`, in number order (other
 * files are ignored). Throws `MigrationError` for a badly named `.sql` file or two files with one number.
 *
 * @example
 * const migrations = await readMigrations(new URL("../../migration/", import.meta.url));
 * // [{ name: "0001-account", sql: "create table account (…);" }, …]
 */
export async function readMigrations(folder: URL | string): Promise<Migration[]> {
  const directory = typeof folder === "string" ? folder : fileURLToPath(folder);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  const numbers = new Set<string>();
  const migrations: Migration[] = [];
  for (const file of files) {
    const match = FILE_NAME.exec(file);
    if (!match) throw new MigrationError("invalid-name", `${file} must be named <four digits>-<kebab-case>.sql`);
    const number = match[1]!;
    if (numbers.has(number)) throw new MigrationError("duplicate", `two migrations are numbered ${number}`);
    numbers.add(number);
    migrations.push({ name: file.slice(0, -".sql".length), sql: await readFile(join(directory, file), "utf8") });
  }
  return migrations;
}
