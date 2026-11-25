import { expect, test } from "vitest";
import { createMemoryBackupStorage } from "@sharadox/database-web-library/memory-backup-storage";

test("keeps backups in memory, listed in name order under a prefix", async () => {
  const storage = createMemoryBackupStorage();
  await storage.put("b/2", new Uint8Array([2]), "application/octet-stream");
  await storage.put("b/1", new Uint8Array([1]), "application/json");
  await storage.put("a/1", new Uint8Array([3]), "application/json");
  expect(await storage.list("b/")).toEqual(["b/1", "b/2"]);
  expect(await storage.get("b/2")).toEqual(new Uint8Array([2]));
  expect(storage.files.size).toBe(3);
  await expect(storage.get("missing")).rejects.toThrow(/no backup file "missing"/);
});
