import api from "../api";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

/**
 * Uploads an image file directly to AWS S3 using presigned PUT grants,
 * reporting upload progress and confirming the two-phase commit with SOLITX backend.
 *
 * @param {File} file - Browser File object
 * @param {Function} [onProgress] - Optional progress callback receiving percent (0-100)
 * @returns {Promise<{ mediaId: string }>}
 */
export async function uploadMediaDirectToS3(file, onProgress) {
  // 1. Validation
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      "Unsupported image format. Please upload JPEG, PNG, WebP, GIF, or AVIF.",
    );
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image size exceeds 15MB limit.");
  }

  // 2. Request presigned upload grant from backend
  const grantRes = await api.post("/media/upload-url", {
    mime_type: file.type,
    file_size_bytes: file.size,
  });

  const { media_id, upload_url } = grantRes.data.data;

  // 3. Upload directly to S3 via PUT with XMLHttpRequest for live progress
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload_url, true);
    xhr.setRequestHeader("Content-Type", file.type);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(`Direct S3 upload failed with HTTP status ${xhr.status}`),
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error communicating directly with AWS S3"));
    };

    xhr.send(file);
  });

  // 4. Confirm upload with backend & enqueue asynchronous Sharp WebP worker
  await api.post("/media/confirm", { media_id });

  return { mediaId: media_id };
}
