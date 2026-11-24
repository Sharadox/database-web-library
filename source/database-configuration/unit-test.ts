import { expect, test } from "vitest";
import { readDatabaseConfiguration } from "@sharadox/database-web-library/database-configuration";

test("reads the connection address from DATABASE_URL", () => {
  expect(
    readDatabaseConfiguration({ DATABASE_URL: "postgresql://user:secret@example.neon.tech/main?sslmode=require" }),
  ).toEqual({ connectionString: "postgresql://user:secret@example.neon.tech/main?sslmode=require" });
});

test("accepts the postgres:// form too", () => {
  expect(readDatabaseConfiguration({ DATABASE_URL: "postgres://user@localhost/main" }).connectionString).toBe(
    "postgres://user@localhost/main",
  );
});

test("names the missing variable", () => {
  expect(() => readDatabaseConfiguration({})).toThrow("DATABASE_URL is missing");
});

test("refuses an address that isn't Postgres, without repeating it (it may hold a password)", () => {
  expect(() => readDatabaseConfiguration({ DATABASE_URL: "mysql://user:secret@host/main" })).toThrow(
    "DATABASE_URL must be a postgres:// or postgresql:// address",
  );
  try {
    readDatabaseConfiguration({ DATABASE_URL: "mysql://user:secret@host/main" });
  } catch (error) {
    expect(String(error)).not.toContain("secret");
  }
});

test("reads process.env by default", () => {
  process.env.DATABASE_URL = "postgres://default@localhost/main";
  expect(readDatabaseConfiguration().connectionString).toBe("postgres://default@localhost/main");
  delete process.env.DATABASE_URL;
});
