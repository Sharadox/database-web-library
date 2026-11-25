import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { BackupStorage, BackupStorageOptions } from "@sharadox/database-web-library/backup-storage/type";

/**
 * Backups in an S3 bucket, under the environment's folder. The bucket's Object Lock (compliance mode) keeps every
 * file for its retention, so nobody, not even the account's owner, can delete or change one: this storage only
 * writes, reads and lists.
 *
 * @example
 * const storage = createBackupStorage({ bucket, region: "eu-central-1", prefix: "production", credentials });
 */
export function createBackupStorage({ bucket, region, prefix, credentials }: BackupStorageOptions): BackupStorage {
  const client = new S3Client({ region, credentials });
  const at = (name: string) => `${prefix}/${name}`;
  return {
    put: async (name, bytes, contentType) => {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: at(name), Body: bytes, ContentType: contentType }));
    },
    get: async (name) => {
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: at(name) }));
      return object.Body!.transformToByteArray();
    },
    list: async (start) => {
      const listing = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: at(start) }));
      return (listing.Contents ?? []).map(({ Key }) => Key!.slice(prefix.length + 1)).sort();
    },
  };
}
