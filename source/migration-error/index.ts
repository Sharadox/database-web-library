import type { MigrationErrorCode } from "@sharadox/database-web-library/migration-error/type";

/**
 * The one error migrations throw when they refuse to run, with a `code` to branch on.
 *
 * @example
 * try {
 *   await migrate(database, migrations);
 * } catch (error) {
 *   if (error instanceof MigrationError && error.code === "changed") console.error(error.message);
 * }
 */
export class MigrationError extends Error {
  override readonly name = "MigrationError";
  /** What went wrong. */
  readonly code: MigrationErrorCode;

  constructor(code: MigrationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
