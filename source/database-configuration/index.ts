import { z } from "zod";
import type { DatabaseConfiguration } from "@sharadox/database-web-library/database-configuration/type";

const schema = z.object({
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is missing" })
    .regex(/^postgres(?:ql)?:\/\//, { error: "DATABASE_URL must be a postgres:// or postgresql:// address" }),
});

/**
 * Reads the database's address from the environment (`DATABASE_URL`, as Vercel's Neon integration sets it). Throws a
 * message naming the variable, never its value (it holds the password).
 *
 * @example
 * const database = createDatabase<Schema>(readDatabaseConfiguration());
 */
export function readDatabaseConfiguration(
  environment: Record<string, string | undefined> = process.env,
): DatabaseConfiguration {
  const result = schema.safeParse(environment);
  if (!result.success) throw new Error(result.error.issues.map(({ message }) => message).join("; "));
  return { connectionString: result.data.DATABASE_URL };
}
