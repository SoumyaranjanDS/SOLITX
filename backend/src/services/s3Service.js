import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import { pipeline } from "stream/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
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

// ==========================================
// VIDEO MULTIPART UPLOAD & STREAMING HELPERS
// ==========================================

export const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB limit
export const VIDEO_PART_SIZE_BYTES = 5 * 1024 * 1024; // 5MB minimum S3 part size

/**
 * Initiates an S3 Multipart Upload for a video file.
 */
export async function initiateVideoMultipartUpload({
  userId,
  mimeType,
  fileSizeBytes,
  originalFilename,
}) {
  if (!ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) {
    throw new AppError(
      400,
      `Unsupported video format '${mimeType}'. Allowed: MP4, MOV, WebM, M4V.`
    );
  }

  if (fileSizeBytes && fileSizeBytes > MAX_VIDEO_SIZE_BYTES) {
    throw new AppError(
      400,
      `Video file size (${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed limit of 100MB.`
    );
  }

  let extension = "mp4";
  if (mimeType === "video/quicktime") extension = "mov";
  else if (mimeType === "video/webm") extension = "webm";
  else if (mimeType === "video/x-m4v") extension = "m4v";
  else if (originalFilename && originalFilename.includes(".")) {
    const ext = originalFilename.split(".").pop().toLowerCase();
    if (["mp4", "mov", "webm", "m4v"].includes(ext)) {
      extension = ext;
    }
  }

  const uniqueId = crypto.randomUUID();
  const s3Key = `raw/videos/${userId}/${Date.now()}_${uniqueId}.${extension}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
  });

  const response = await s3.send(command);
  const totalParts = fileSizeBytes ? Math.ceil(fileSizeBytes / VIDEO_PART_SIZE_BYTES) : 1;

  return {
    uploadId: response.UploadId,
    s3Key,
    bucket,
    totalParts,
    partSizeBytes: VIDEO_PART_SIZE_BYTES,
  };
}

/**
 * Generates a presigned URL for uploading a specific part of a multipart upload.
 */
export async function getVideoPartUploadUrl({ s3Key, uploadId, partNumber }) {
  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: s3Key,
    UploadId: uploadId,
    PartNumber: Number(partNumber),
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
  return {
    partNumber: Number(partNumber),
    uploadUrl,
  };
}

/**
 * Generates presigned URLs for multiple parts in parallel.
 */
export async function getVideoPartUploadUrls({ s3Key, uploadId, partNumbers }) {
  const promises = partNumbers.map((partNumber) =>
    getVideoPartUploadUrl({ s3Key, uploadId, partNumber })
  );
  return await Promise.all(promises);
}

/**
 * Completes an S3 Multipart Upload.
 */
export async function completeVideoMultipartUpload({ s3Key, uploadId, parts }) {
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    throw new AppError(400, "Parts array is required to complete multipart upload.");
  }

  // S3 requires parts to be sorted in ascending order by PartNumber
  const sortedParts = parts
    .map((p) => ({
      PartNumber: Number(p.PartNumber || p.partNumber),
      ETag: p.ETag || p.etag,
    }))
    .sort((a, b) => a.PartNumber - b.PartNumber);

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: s3Key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  });

  const response = await s3.send(command);
  return response;
}

/**
 * Aborts an S3 Multipart Upload (cleans up any orphaned parts in S3).
 */
export async function abortVideoMultipartUpload({ s3Key, uploadId }) {
  const command = new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: s3Key,
    UploadId: uploadId,
  });

  return await s3.send(command);
}

/**
 * Streams an S3 object directly to a local file on disk.
 * Memory safe: avoids loading entire video buffer into RAM.
 */
export async function downloadS3FileToLocal(s3Key, localFilePath) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });

  const response = await s3.send(command);
  await pipeline(response.Body, fs.createWriteStream(localFilePath));
}

/**
 * Streams a local file directly from disk into S3.
 * Memory safe: uses read stream with proper content-type and caching.
 */
export async function uploadLocalFileToS3(
  localFilePath,
  s3Key,
  contentType,
  cacheControl = "public, max-age=31536000, immutable"
) {
  const fileStream = fs.createReadStream(localFilePath);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: fileStream,
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  return await s3.send(command);
}
