import { fromWebToken } from "@aws-sdk/credential-providers";
import { dumpDatabase } from "@sharadox/database-web-library/backup-dump";
import type { BackupParts } from "@sharadox/database-web-library/backup-command/type";
import { createBackupStorage } from "@sharadox/database-web-library/backup-storage";
import { createDatabase } from "@sharadox/database-web-library/database";
import { backupDatabase, tableCounts } from "@sharadox/database-web-library/database-backup";
import { gitHubWebIdentityToken } from "@sharadox/database-web-library/git-hub-web-identity";
import { createMemoryDatabase } from "@sharadox/database-web-library/memory-database";
import { restoreDrill } from "@sharadox/database-web-library/restore-drill";

/**
 * Short-lived AWS credentials for `role`, taken with the GitHub Actions job's own identity (no stored key).
 *
 * @example
 * createBackupStorage({ bucket, region, prefix, credentials: gitHubRoleCredentials(role) });
 */
export function gitHubRoleCredentials(role: string, environment: Record<string, string | undefined> = process.env) {
  return async () =>
    fromWebToken({
      roleArn: role,
      webIdentityToken: await gitHubWebIdentityToken(environment),
      roleSessionName: "backup",
    })();
}

/** In a GitHub Actions job: S3 through the job's own identity (no stored key), Neon, and `pg_dump`. */
export const defaultBackupParts: BackupParts = {
  storage: ({ bucket, region, prefix, role }) =>
    createBackupStorage({ bucket, region, prefix, credentials: gitHubRoleCredentials(role) }),
  database: (url) => createDatabase<unknown>({ connectionString: url }),
  dump: dumpDatabase,
  memory: createMemoryDatabase,
  log: (line) => console.log(line),
};

const required = (environment: Record<string, string | undefined>, name: string) => {
  const value = environment[name];
  if (!value) throw new Error(`${name} is missing`);
  return value;
};

/**
 * What a site's backup workflow runs: `backup` (the production database, dumped, encrypted and stored) or `drill`
 * (the newest backup restored into Postgres in memory and checked). Settings: `BACKUP_BUCKET`, `BACKUP_REGION`,
 * `BACKUP_PREFIX`, `BACKUP_ROLE` (the IAM role the job's GitHub identity takes), `BACKUP_ENCRYPTION_KEY`, and for a
 * backup `DATABASE_BACKUP_URL` (a read-only role). Returns the exit code.
 *
 * @example
 * // node -e 'import("@sharadox/database-web-library/backup-command").then(async (m) => process.exit(await m.runBackupCommand("backup")))'
 */
export async function runBackupCommand(
  command: string,
  environment: Record<string, string | undefined> = process.env,
  parts: Partial<BackupParts> = {},
): Promise<number> {
  if (command !== "backup" && command !== "drill") throw new Error(`"${command}": the command is backup or drill`);
  const { storage, database, dump, memory, log } = { ...defaultBackupParts, ...parts };
  const store = storage({
    bucket: required(environment, "BACKUP_BUCKET"),
    region: required(environment, "BACKUP_REGION"),
    prefix: required(environment, "BACKUP_PREFIX"),
    role: required(environment, "BACKUP_ROLE"),
  });
  const key = required(environment, "BACKUP_ENCRYPTION_KEY");
  if (command === "backup") {
    const url = required(environment, "DATABASE_BACKUP_URL");
    const source = database(url);
    try {
      const result = await backupDatabase({
        dump: () => dump(url),
        counts: () => tableCounts(source),
        storage: store,
        key,
      });
      const rows = Object.entries(result.tables).map(([table, count]) => `${table} ${count}`);
      log(`backed up ${result.file}: ${rows.join(", ")}`);
      return 0;
    } finally {
      await source.destroy();
    }
  }
  const into = await memory();
  try {
    const result = await restoreDrill({ storage: store, key, into: into.database });
    const wrong = result.tables.filter(({ expected, restored }) => expected !== restored);
    log(
      result.ok
        ? `restore drill passed: the backup of ${result.createdAt}, ${result.tables.length} tables`
        : `restore drill FAILED: ${wrong.map(({ table, expected, restored }) => `${table} ${restored} of ${expected}`).join(", ")}`,
    );
    return result.ok ? 0 : 1;
  } finally {
    await into.close();
  }
}
