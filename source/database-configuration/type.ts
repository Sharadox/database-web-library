/** How to reach the database. */
export interface DatabaseConfiguration {
  /** `postgresql://…` (Neon gives it with `?sslmode=require`). A secret: it holds the password. */
  connectionString: string;
}
