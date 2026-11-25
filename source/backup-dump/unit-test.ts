import { expect, test } from "vitest";
import { dumpDatabase, restorableSql } from "@sharadox/database-web-library/backup-dump";

test("asks pg_dump for the public schema as plain INSERTs, without owners or grants, the password kept off the command", async () => {
  const calls: { command: string; arguments: string[]; environment: Record<string, string | undefined> }[] = [];
  const sql = await dumpDatabase("postgresql://user:secret@example.neon.tech/neondb?sslmode=require", {
    run: async (command, given, environment) => {
      calls.push({ command, arguments: given, environment });
      return new TextEncoder().encode("-- dump\n");
    },
  });
  expect(new TextDecoder().decode(sql)).toBe("-- dump\n");
  expect(calls[0]!.command).toBe("pg_dump");
  expect(calls[0]!.arguments).toEqual([
    "--schema=public",
    "--inserts",
    "--no-owner",
    "--no-privileges",
    "--quote-all-identifiers",
  ]);
  expect(calls[0]!.arguments.join(" ")).not.toContain("secret");
  expect(calls[0]!.environment).toEqual({
    PGHOST: "example.neon.tech",
    PGPORT: "5432",
    PGUSER: "user",
    PGPASSWORD: "secret",
    PGDATABASE: "neondb",
    PGSSLMODE: "require",
  });
  await dumpDatabase("postgres://us%40er:p%2Fw@host.example:6543/data", {
    run: async (_program, _parameters, environment) => {
      calls.push({ command: "", arguments: [], environment });
      return new Uint8Array();
    },
  });
  expect(calls[1]!.environment).toMatchObject({
    PGUSER: "us@er",
    PGPASSWORD: "p/w",
    PGPORT: "6543",
    PGSSLMODE: "verify-full",
  });
});

test("runs the real program by default, and reports its failure", async () => {
  await expect(dumpDatabase("postgresql://nobody@127.0.0.1:1/none", { program: "false" })).rejects.toThrow(
    /false failed/,
  );
  const echoed = await dumpDatabase("postgresql://x@y/z", { program: "echo" });
  expect(new TextDecoder().decode(echoed)).toContain("--inserts");
});

test("drops psql's own commands, the public schema's creation and Neon's own column options, so any empty Postgres can run it", () => {
  expect(restorableSql("\\restrict abc\nSET x = 1;\n\\unrestrict abc\nselect 1;\n")).toBe("SET x = 1;\nselect 1;\n");
  expect(
    restorableSql('ALTER TABLE ONLY "public"."account" ALTER COLUMN "id" SET (pg_attver=30783424);\nselect 2;\n'),
  ).toBe("select 2;\n");
  expect(restorableSql('CREATE SCHEMA "public";\nCOMMENT ON SCHEMA "public" IS \'x\';\nselect 1;\n')).toBe(
    "select 1;\n",
  );
});
