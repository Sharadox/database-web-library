import { PGlite } from "@electric-sql/pglite";
import { expect, test } from "vitest";
import { pglitePool } from "@sharadox/database-web-library/pglite-pool";

test("runs several statements at once when there are no parameters, like Postgres's simple protocol", async () => {
  const pool = pglitePool(new PGlite());
  const client = await pool.connect();
  const result = await client.query<{ total: number }>(
    "create table item (n int); insert into item values (1), (2); select sum(n)::int as total from item",
    [],
  );
  expect(result).toEqual({ command: "SELECT", rowCount: 1, rows: [{ total: 3 }] });
  client.release();
  await pool.end();
});

test("binds parameters and reports changed rows", async () => {
  const pool = pglitePool(new PGlite());
  const client = await pool.connect();
  await client.query("create table item (n int)", []);
  const result = await client.query("insert into item values ($1), ($2)", [1, 2]);
  expect(result).toEqual({ command: "INSERT", rowCount: 2, rows: [] });
  client.release();
  await pool.end();
});

test("reports statements that change no rows, and empty ones", async () => {
  const pool = pglitePool(new PGlite());
  const client = await pool.connect();
  expect(await client.query("create table item (n int)", [])).toEqual({ command: "CREATE", rowCount: 0, rows: [] });
  expect(await client.query("", [])).toEqual({ command: "SELECT", rowCount: 0, rows: [] });
  client.release();
  await pool.end();
});

test("hands out one connection at a time, in order", async () => {
  const pool = pglitePool(new PGlite());
  const order: string[] = [];
  const first = await pool.connect();
  const second = pool.connect().then((client) => {
    order.push("second");
    client.release();
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  order.push("first");
  first.release();
  await second;
  expect(order).toEqual(["first", "second"]);
  await pool.end();
});

test("refuses cursors, which this pool doesn't stream", async () => {
  const pool = pglitePool(new PGlite());
  const client = await pool.connect();
  await expect(client.query({ read: async () => [], close: async () => undefined } as never)).rejects.toThrow(
    "streaming is not supported",
  );
  client.release();
  await pool.end();
});
