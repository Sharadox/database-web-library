/** Where backups are kept (an S3 bucket with Object Lock, or memory in tests). Nothing can be deleted through it. */
export interface BackupStorage {
  put(name: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(name: string): Promise<Uint8Array>;
  /** The names under `prefix`, in name order (which is time order for backups). */
  list(prefix: string): Promise<string[]>;
}

export interface BackupStorageOptions {
  bucket: string;
  region: string;
  /** The environment's folder in the bucket (`production`). */
  prefix: string;
  /** Short-lived AWS credentials (from the job's own identity, never a stored key). */
  credentials: import("@aws-sdk/client-s3").S3ClientConfig["credentials"];
}
