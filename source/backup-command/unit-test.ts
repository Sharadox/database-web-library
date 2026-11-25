import { expect, test, vi } from "vitest";
import { runBackupCommand } from "@sharadox/database-web-library/backup-command";
import { createMemoryBackupStorage } from "@sharadox/database-web-library/memory-backup-storage";
import { createMemoryDatabase } from "@sharadox/database-web-library/memory-database";

const environment = {
  DATABASE_BACKUP_URL: "postgresql://reader:secret@example.neon.tech/neondb",
  BACKUP_ENCRYPTION_KEY: "a-backup-key-of-at-least-thirty-two-characters",
  BACKUP_BUCKET: "sharadox-x-backup",
  BACKUP_REGION: "eu-central-1",
  BACKUP_ROLE: "arn:aws:iam::123456789012:role/sharadox/backup/x",
  BACKUP_PREFIX: "production",
};

test("backs up, then the drill restores it and finds every row", async () => {
  const storage = createMemoryBackupStorage();
  const source = await createMemoryDatabase();
  const log = vi.fn();
  const storageFor = vi.fn(() => storage);
  const parts = {
    storage: storageFor,
    database: vi.fn(() => source.database),
    dump: vi.fn(async () =>
      new TextEncoder().encode(
        `\\restrict x\ncreate table note (id int);\ninsert into note values (1);\n\\unrestrict x\n`,
      ),
    ),
    memory: createMemoryDatabase,
    log,
  };
  await (await import("kysely")).sql`create table note (id int); insert into note values (1);`.execute(source.database);
  expect(await runBackupCommand("backup", environment, parts)).toBe(0);
  expect(storageFor).toHaveBeenCalledWith(
    expect.objectContaining({ bucket: "sharadox-x-backup", prefix: "production" }),
  );
  expect(parts.dump).toHaveBeenCalledWith(environment.DATABASE_BACKUP_URL);
  expect(log.mock.calls[0]![0]).toMatch(/^backed up .*\.sql\.gz\.enc: note 1$/);
  expect(await runBackupCommand("drill", environment, parts)).toBe(0);
  expect(log.mock.calls.at(-1)![0]).toMatch(/^restore drill passed/);
});

test("a failed drill exits with 1, naming the tables", async () => {
  const storage = createMemoryBackupStorage();
  const { backupDatabase } = await import("@sharadox/database-web-library/database-backup");
  await backupDatabase({
    dump: async () => new TextEncoder().encode("create table note (id int);"),
    counts: async () => ({ note: 5 }),
    storage,
    key: environment.BACKUP_ENCRYPTION_KEY,
  });
  const log = vi.fn();
  expect(
    await runBackupCommand("drill", environment, { storage: () => storage, memory: createMemoryDatabase, log }),
  ).toBe(1);
  expect(log.mock.calls[0]![0]).toBe("restore drill FAILED: note 0 of 5");
});

test("names a missing setting, and an unknown command", async () => {
  await expect(runBackupCommand("backup", { ...environment, BACKUP_ROLE: undefined })).rejects.toThrow(
    "BACKUP_ROLE is missing",
  );
  await expect(runBackupCommand("explode", environment)).rejects.toThrow(/backup or drill/);
});

test("by default, S3 through the job's GitHub identity, Neon and pg_dump", async () => {
  const { defaultBackupParts } = await import("@sharadox/database-web-library/backup-command");
  const storage = defaultBackupParts.storage({
    ...environment,
    bucket: "b",
    region: "eu-central-1",
    prefix: "p",
    role: environment.BACKUP_ROLE,
  });
  expect(typeof storage.put).toBe("function");
  const database = defaultBackupParts.database(environment.DATABASE_BACKUP_URL);
  expect(typeof database.selectFrom).toBe("function");
  await database.destroy();
  expect(defaultBackupParts.dump).toBe((await import("@sharadox/database-web-library/backup-dump")).dumpDatabase);
  expect(defaultBackupParts.memory).toBe(createMemoryDatabase);
  const print = vi.spyOn(console, "log").mockImplementation(() => {});
  defaultBackupParts.log("a line");
  expect(print).toHaveBeenCalledWith("a line");
});

test("credentials come from the job's identity, so outside a job there are none", async () => {
  const { gitHubRoleCredentials } = await import("@sharadox/database-web-library/backup-command");
  await expect(gitHubRoleCredentials("arn:aws:iam::1:role/x", {})()).rejects.toThrow(/id-token: write/);
});
