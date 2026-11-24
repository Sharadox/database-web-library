import { nodeConfiguration } from "@sharadox/es-lint-configuration-web-library/node";
import { databaseEsLintPlugin } from "./source/es-lint-plugin/index.ts";

export default [...nodeConfiguration(), ...databaseEsLintPlugin.configs.recommended];
