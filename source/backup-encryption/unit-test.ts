import { expect, test } from "vitest";
import { decryptBackup, encryptBackup } from "@sharadox/database-web-library/backup-encryption";

const key = "a-backup-key-of-at-least-thirty-two-characters";

test("encrypts a backup with AES-256-GCM, differently every time, and decrypts it", () => {
  const plain = new TextEncoder().encode("insert into note values (1);");
  const sealed = encryptBackup(plain, key);
  expect(new TextDecoder().decode(sealed.subarray(0, 17))).toBe("SHARADOX-BACKUP-1");
  expect(encryptBackup(plain, key)).not.toEqual(sealed);
  expect(decryptBackup(sealed, key)).toEqual(plain);
});

test("refuses a wrong key, a changed byte, another format and a short key", () => {
  const sealed = encryptBackup(new Uint8Array([1, 2, 3]), key);
  expect(() => decryptBackup(sealed, `${key}x`)).toThrow();
  const changed = new Uint8Array(sealed);
  changed[changed.length - 1]! ^= 1;
  expect(() => decryptBackup(changed, key)).toThrow();
  expect(() => decryptBackup(new TextEncoder().encode("SOMETHING-ELSE-XX and more"), key)).toThrow(/not a backup/);
  expect(() => encryptBackup(new Uint8Array([1]), "short")).toThrow(/32 characters/);
});
