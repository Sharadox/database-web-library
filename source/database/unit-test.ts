import { afterEach, expect, test, vi } from "vitest";

const created: unknown[] = [];
vi.mock("@neondatabase/serverless", () => ({
  Pool: class {
    constructor(options: unknown) {
      created.push(options);
    }
    end() {
      return Promise.resolve();
    }
  },
}));

const { createDatabase } = await import("@sharadox/database-web-library/database");

afterEach(() => created.splice(0));

test("connects through a Neon pool, only when the first query runs", async () => {
  const database = createDatabase<unknown>({ connectionString: "postgres://user@host/main" });
  expect(created).toEqual([{ connectionString: "postgres://user@host/main" }]);
  await database.destroy();
});
