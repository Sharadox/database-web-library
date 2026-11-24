/** One forward-only change to the database: its name (`0001-account`) and its SQL, one or more statements. */
export interface Migration {
  name: string;
  sql: string;
}

/** Where `migrate` keeps its records. */
export interface MigrateOptions {
  /** The table that remembers applied migrations (a plain lowercase identifier); `schema_migration` by default. */
  table?: string;
}
