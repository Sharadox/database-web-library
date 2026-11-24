import type { Kysely } from "kysely";

/** A database in memory and the way to close it. */
export interface MemoryDatabase<Schema> {
  /** Kysely, typed by the schema. */
  database: Kysely<Schema>;
  /** Closes the database; it is gone afterwards. */
  close(): Promise<void>;
}
