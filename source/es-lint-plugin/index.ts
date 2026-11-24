import type { ESLint, Linter, Rule } from "eslint";

/** Calls that send text to the database as SQL, unchecked: `sql.raw`, `sql.lit`, `CompiledQuery.raw`, `.unsafe`. */
const RAW = new Map([
  ["sql", new Set(["raw", "lit"])],
  ["CompiledQuery", new Set(["raw"])],
]);

/** Whether SQL text is put together from pieces at run time (a template with values, or `+`). */
const isBuilt = (node: { type: string } | undefined): boolean =>
  node?.type === "BinaryExpression" ||
  (node?.type === "TemplateLiteral" && (node as { type: string; expressions: unknown[] }).expressions.length > 0);

/**
 * ESLint rule `no-raw-sql`: values reach the database only as bound parameters, never inside the SQL text. Reports
 * `sql.raw()`, `sql.lit()`, `CompiledQuery.raw()` and any `.unsafe()`, and a `.query()` whose SQL is built with `+`
 * or a template with `${…}`. Kysely's tagged ``sql`…${value}…` `` stays allowed: its values are parameters. The rare
 * reviewed exception (running a migration file) disables the rule on that line, with the reason.
 */
export const noRawSql: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Send values to the database as parameters, never inside SQL text" },
    messages: {
      raw: "Raw SQL can carry injected text: build the query with Kysely, or ``sql`…${value}…` `` (values become parameters).",
      built: "This SQL is put together from pieces at run time: pass the values as parameters ($1, $2…) instead.",
    },
    schema: [],
  },
  create: (context) => ({
    CallExpression(node) {
      if (node.callee.type !== "MemberExpression" || node.callee.property.type !== "Identifier") return;
      const method = node.callee.property.name;
      const object = node.callee.object.type === "Identifier" ? node.callee.object.name : "";
      if (method === "unsafe" || RAW.get(object)?.has(method)) context.report({ node, messageId: "raw" });
      else if (method === "query" && isBuilt(node.arguments[0])) context.report({ node, messageId: "built" });
    },
  }),
};

const plugin = {
  meta: { name: "@sharadox/database-web-library/es-lint-plugin" },
  rules: { "no-raw-sql": noRawSql },
  configs: {} as { recommended: Linter.Config[] },
} satisfies ESLint.Plugin;
plugin.configs.recommended = [
  { plugins: { "@sharadox/database": plugin }, rules: { "@sharadox/database/no-raw-sql": "error" } },
];

/**
 * The ESLint plugin of database-web-library, with `configs.recommended` turning `no-raw-sql` on.
 *
 * @example
 * // eslint.config.mjs
 * import { nodeConfiguration } from "@sharadox/es-lint-configuration-web-library/node";
 * import { databaseEsLintPlugin } from "@sharadox/database-web-library/es-lint-plugin";
 * export default [...nodeConfiguration(), ...databaseEsLintPlugin.configs.recommended];
 */
export const databaseEsLintPlugin = plugin;
