import { RuleTester } from "eslint";
import { describe, expect, test } from "vitest";
import { databaseEsLintPlugin, noRawSql } from "@sharadox/database-web-library/es-lint-plugin";

RuleTester.describe = describe;
RuleTester.it = test;
RuleTester.itOnly = test.only;

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2024, sourceType: "module" } });

tester.run("no-raw-sql", noRawSql, {
  valid: [
    "await database.selectFrom('account').where('id', '=', id).execute();",
    "await sql`select * from account where id = ${id}`.execute(database);",
    "await client.query('select * from account where id = $1', [id]);",
    "await client.query(`select 1`);",
    "const text = `hello ${name}`;",
    "record.raw;",
    "other.raw(text);",
    "query();",
  ],
  invalid: [
    { code: "sql.raw(text);", errors: [{ messageId: "raw" }] },
    { code: "sql.lit(value);", errors: [{ messageId: "raw" }] },
    { code: "client.unsafe(text);", errors: [{ messageId: "raw" }] },
    { code: "CompiledQuery.raw(text);", errors: [{ messageId: "raw" }] },
    { code: "client.query(`select * from account where id = '${id}'`);", errors: [{ messageId: "built" }] },
    { code: "client.query('select * from account where id = ' + id);", errors: [{ messageId: "built" }] },
    { code: 'pool.query("delete from " + table, []);', errors: [{ messageId: "built" }] },
  ],
});

test("the plugin turns the rule on under @sharadox/database", () => {
  const [configuration] = databaseEsLintPlugin.configs.recommended;
  expect(configuration?.plugins?.["@sharadox/database"]).toBe(databaseEsLintPlugin);
  expect(configuration?.rules).toEqual({ "@sharadox/database/no-raw-sql": "error" });
  expect(databaseEsLintPlugin.rules["no-raw-sql"]).toBe(noRawSql);
});
