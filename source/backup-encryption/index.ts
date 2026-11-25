import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const MAGIC = new TextEncoder().encode("SHARADOX-BACKUP-1");

const keyBytes = (key: string) => {
  if (key.length < 32) throw new Error("the backup key must have at least 32 characters");
  return createHash("sha256").update(key).digest();
};

/**
 * Encrypts a backup with AES-256-GCM under a key kept apart from it (`BACKUP_ENCRYPTION_KEY`), so a copy of the
 * bucket reveals nothing and any change is detected. Layout: `SHARADOX-BACKUP-1`, a 12-byte IV, the 16-byte tag,
 * then the ciphertext.
 *
 * @example
 * const sealed = encryptBackup(gzipSync(dump), process.env.BACKUP_ENCRYPTION_KEY!);
 */
export function encryptBackup(plain: Uint8Array, key: string): Uint8Array {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return new Uint8Array(Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]));
}

/**
 * Decrypts what `encryptBackup` made; throws for a wrong key, a changed byte, or anything else.
 *
 * @example
 * const plain = decryptBackup(sealed, process.env.BACKUP_ENCRYPTION_KEY!);
 */
export function decryptBackup(sealed: Uint8Array, key: string): Uint8Array {
  const bytes = Buffer.from(sealed);
  if (!bytes.subarray(0, MAGIC.length).equals(Buffer.from(MAGIC))) throw new Error("this is not a backup file");
  const iv = bytes.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = bytes.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), iv);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(bytes.subarray(MAGIC.length + 28)), decipher.final()]));
}
