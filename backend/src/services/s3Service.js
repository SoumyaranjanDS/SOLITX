import dotenv from "dotenv";
dotenv.config();

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { AppError } from "../utils/AppError.js";

const region = process.env.AWS_REGION || "ap-south-1";
const bucket =
  process.env.AWS_S3_BUCKET_NAME ||
  "solitx-media-prod-soumya-842806122222-ap-south-1-an";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;

export const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

// Allowed MIME types for images
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit

/**
 * Generates an S3 Presigned Upload URL for direct client-to-S3 uploads.
 * Bypasses API server compute & network bandwidth.
 */
export async function generatePresignedUploadUrl({
  userId,
  mimeType,
  fileSizeBytes,
}) {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new AppError(
      400,
      `Unsupported image format '${mimeType}'. Allowed: JPEG, PNG, WebP, GIF, AVIF.`,
    );
  }

  if (fileSizeBytes && fileSizeBytes > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError(
      400,
      `Image size exceeds the maximum allowed limit of 15MB.`,
    );
  }

  const extension = mimeType.split("/")[1].replace("jpeg", "jpg");
  const uniqueId = crypto.randomUUID();
  const s3Key = `raw/${userId}/${Date.now()}_${uniqueId}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
  });

  // Presigned URL valid for 5 minutes (300 seconds)
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return {
    uploadUrl,
    s3Key,
    bucket,
    expiresInSeconds: 300,
  };
}

/**
 * Downloads raw object stream from S3 as a Uint8Array buffer.
 */
export async function getS3Buffer(key) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3.send(command);
  return await response.Body.transformToByteArray();
}

/**
 * Uploads an optimized image variant to S3 with immutable cache headers.
 */
export async function putS3Object({
  key,
  body,
  contentType,
  cacheControl = "public, max-age=31536000, immutable",
}) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  return await s3.send(command);
}

/**
 * Deletes an object from S3.
 */
export async function deleteS3Object(key) {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await s3.send(command);
}

/**
 * Returns the public media base URL (CloudFront CDN or direct S3 bucket origin).
 */
export function getMediaBaseUrl() {
  if (cloudfrontDomain) {
    return `https://${cloudfrontDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/`;
}

/**
 * Constructs the public access URL (via CloudFront CDN or fallback direct S3).
 */
export function buildPublicMediaUrl(key) {
  if (!key) return null;
  return `${getMediaBaseUrl()}${key.replace(/^\/+/, "")}`;
}
