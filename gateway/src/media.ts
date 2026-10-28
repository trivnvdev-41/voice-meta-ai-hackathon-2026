import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type Presign = (key: string) => Promise<string>;

export interface S3Config {
  s3Endpoint?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
}

/**
 * Signs a stored object key on read, so links never outlive the archive.
 * Returns undefined when S3 is not configured (audio stays unavailable).
 */
export function createPresigner(cfg: S3Config): Presign | undefined {
  const { s3Endpoint, s3Bucket, s3AccessKey, s3SecretKey } = cfg;
  if (!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) return undefined;
  const client = new S3Client({
    region: "auto",
    endpoint: s3Endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
  });
  return (key) =>
    getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: s3Bucket, Key: key }),
      { expiresIn: 3600 },
    );
}
