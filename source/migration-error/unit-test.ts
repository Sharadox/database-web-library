import { expect, test } from "vitest";
import { MigrationError } from "@sharadox/database-web-library/migration-error";

test("names what went wrong, with a code to branch on", () => {
  const error = new MigrationError("changed", "0001-note was changed after it was applied");
  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe("MigrationError");
  expect(error.code).toBe("changed");
  expect(error.message).toBe("0001-note was changed after it was applied");
});
