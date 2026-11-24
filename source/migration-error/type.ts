/**
 * Why migrations were refused: a file name that isn't `<four digits>-<kebab-case>.sql` (`invalid-name`), two
 * files with one number (`duplicate`), an applied migration edited (`changed`) or removed (`missing`), or a new one
 * numbered before one already applied (`out-of-order`).
 */
export type MigrationErrorCode = "invalid-name" | "duplicate" | "changed" | "missing" | "out-of-order";
