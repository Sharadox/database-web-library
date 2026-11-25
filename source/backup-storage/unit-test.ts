import { beforeEach, expect, test, vi } from "vitest";

const sent = vi.hoisted(() => [] as { name: string; input: Record<string, unknown> }[]);
const objects = vi.hoisted(() => new Map<string, Uint8Array>());
const clients = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@aws-sdk/client-s3", () => {
  const command = (name: string) =>
    class {
      input: Record<string, unknown>;
      name = name;
      constructor(input: Record<string, unknown>) {
        this.input = input;
      }
    };
  return {
    PutObjectCommand: command("put"),
    GetObjectCommand: command("get"),
    ListObjectsV2Command: command("list"),
    S3Client: class {
      constructor(configuration: Record<string, unknown>) {
        clients.push(configuration);
      }
      async send(given: { name: string; input: Record<string, unknown> }) {
        sent.push(given);
        if (given.name === "put") objects.set(String(given.input.Key), given.input.Body as Uint8Array);
        if (given.name === "get")
          return { Body: { transformToByteArray: async () => objects.get(String(given.input.Key))! } };
        if (given.name === "list")
          return {
            Contents: [...objects.keys()]
              .filter((key) => key.startsWith(String(given.input.Prefix)))
              .map((Key) => ({ Key })),
          };
        return {};
      }
    },
  };
});
const { createBackupStorage } = await import("@sharadox/database-web-library/backup-storage");

beforeEach(() => {
  sent.length = 0;
  objects.clear();
  clients.length = 0;
});

test("keeps backups in S3 under a prefix, with the given credentials, and lists them", async () => {
  const credentials = async () => ({ accessKeyId: "a", secretAccessKey: "b" });
  const storage = createBackupStorage({
    bucket: "sharadox-x-backup",
    region: "eu-central-1",
    prefix: "production",
    credentials,
  });
  expect(clients[0]).toEqual({ region: "eu-central-1", credentials });
  await storage.put("2026/11/25/backup.enc", new Uint8Array([1]), "application/octet-stream");
  expect(sent[0]).toMatchObject({
    name: "put",
    input: { Bucket: "sharadox-x-backup", Key: "production/2026/11/25/backup.enc" },
  });
  expect(await storage.get("2026/11/25/backup.enc")).toEqual(new Uint8Array([1]));
  expect(await storage.list("2026/")).toEqual(["2026/11/25/backup.enc"]);
  objects.clear();
  expect(await storage.list("2026/")).toEqual([]);
});

test("an empty listing has no contents at all", async () => {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const storage = createBackupStorage({
    bucket: "b",
    region: "r",
    prefix: "p",
    credentials: async () => ({ accessKeyId: "a", secretAccessKey: "b" }),
  });
  vi.spyOn(S3Client.prototype, "send").mockResolvedValueOnce({} as never);
  expect(await storage.list("")).toEqual([]);
});
