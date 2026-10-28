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
 * reporting upload progress, confirming the two-phase commit with SOLITX backend,
 * and awaiting asynchronous Sharp WebP variant generation on CloudFront CDN.
 *
 * @param {File} file - Browser File object
 * @param {Function} [onProgress] - Optional progress callback receiving percent (0-100)
 * @param {Object} [options] - Optional settings: { entityType: 'avatar' | 'banner' | 'post', waitForReady: boolean }
 * @returns {Promise<{ mediaId: string, publicUrl: string, urlFeed?: string, urlThumb?: string, urlFull?: string, status: string }>}
 */
export async function uploadMediaDirectToS3(file, onProgress, options = {}) {
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
    entity_type: options.entityType || undefined,
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
  const confirmRes = await api.post("/media/confirm", {
    media_id,
    entity_type: options.entityType || undefined,
  });

  let finalMedia = confirmRes.data?.data || {};

  // 5. Poll for asynchronous Sharp worker WebP optimization
  // Sharp worker completes in ~100-250ms, so polling 1-3 times resolves immediately
  if (options.waitForReady !== false && finalMedia.status === "processing") {
    const maxRetries = 15; // 15 * 200ms = 3.0s max timeout
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const pollRes = await api.get(`/media/${media_id}`);
        const data = pollRes.data?.data;
        if (data && data.status === "ready") {
          finalMedia = data;
          break;
        }
      } catch {
        // Continue loop if temporary network fluctuation occurs
      }
    }
  }

  const urlThumb = finalMedia.url_thumb || null;
  const urlFeed = finalMedia.url_feed || null;
  const urlFull = finalMedia.url_full || null;

  // Prefer responsive WebP variant: feed (600px) or full (1200px) or thumb (150px)
  const optimizedUrl =
    (options.entityType === "thumb" ? urlThumb : null) ||
    urlFeed ||
    urlFull ||
    urlThumb ||
    finalMedia.public_url ||
    "";

  return {
    mediaId: media_id,
    publicUrl: optimizedUrl,
    urlThumb,
    urlFeed,
    urlFull,
    status: finalMedia.status || "ready",
  };
}
