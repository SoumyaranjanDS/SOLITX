import api from "../api";

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
];

export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
export const MAX_VIDEO_DURATION_SECONDS = 120.5; // 2 minutes

/**
 * Uploads a single multipart chunk to S3 with exponential backoff retry.
 * Retries up to 3 times on network failure or 5xx error before giving up.
 */
async function uploadChunkWithRetry({
  chunk,
  uploadUrl,
  partNumber,
  onProgress,
  maxRetries = 3,
}) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              onProgress(evt.loaded);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const rawEtag = xhr.getResponseHeader("ETag") || "";
            resolve(rawEtag.replace(/"/g, ""));
          } else {
            reject(
              new Error(
                `Failed to upload part ${partNumber} (HTTP ${xhr.status})`
              )
            );
          }
        };

        xhr.onerror = () => {
          reject(
            new Error(`Network error uploading part ${partNumber} directly to S3.`)
          );
        };

        xhr.ontimeout = () => {
          reject(new Error(`Timeout uploading part ${partNumber} to S3.`));
        };

        xhr.timeout = 60000; // 60s timeout per 5MB chunk
        xhr.send(chunk);
      });
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw new Error(
          `Failed uploading chunk #${partNumber} after ${maxRetries} retries: ${err.message}`
        );
      }
      // Exponential backoff: ~1s, ~2s, ~4s with jitter
      const backoffMs = Math.pow(2, attempt - 1) * 1000 + Math.random() * 500;
      console.warn(
        `[VideoUpload] ⚠️ Part ${partNumber} upload failed (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(
          backoffMs
        )}ms...`
      );
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

/**
 * Checks video duration in browser before upload.
 */
export function getLocalVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(0);
    };
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Uploads a video file directly to AWS S3 using S3 Multipart Upload.
 * Bypasses application server compute and memory.
 *
 * @param {File} file - Browser File object
 * @param {Function} [onProgress] - Callback for overall percentage (0-100)
 * @returns {Promise<{ videoId: string, status: string, duration: number }>}
 */
export async function uploadVideoDirectToS3(file, onProgress) {
  // 1. Validation
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    throw new Error(
      "Unsupported video format. Allowed formats: MP4, MOV, WebM, M4V."
    );
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error(
      `Video size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 100MB limit.`
    );
  }

  // Pre-validate video duration in browser
  const duration = await getLocalVideoDuration(file);
  if (duration > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error(
      `Video duration (${Math.round(duration)}s) exceeds 120-second maximum limit.`
    );
  }

  // 2. Initiate multipart upload on backend
  const initRes = await api.post("/videos/initiate", {
    mime_type: file.type,
    file_size_bytes: file.size,
    original_filename: file.name,
  });

  const { video_id, total_parts, part_size_bytes } = initRes.data.data;

  // 3. Request presigned URLs for all parts
  const partNumbers = Array.from({ length: total_parts }, (_, i) => i + 1);
  const urlsRes = await api.post("/videos/part-urls", {
    video_id,
    part_numbers: partNumbers,
  });

  const partUrls = urlsRes.data.data.parts; // [{ partNumber, uploadUrl }, ...]

  // 4. Upload parts to S3 in sequence / bounded concurrency
  const uploadedParts = [];
  const partProgress = new Array(total_parts).fill(0);

  const updateOverallProgress = () => {
    if (!onProgress) return;
    const totalBytesUploaded = partProgress.reduce((sum, bytes) => sum + bytes, 0);
    const percent = Math.min(100, Math.round((totalBytesUploaded / file.size) * 100));
    onProgress(percent);
  };

  try {
    for (let i = 0; i < total_parts; i++) {
      const partNumber = i + 1;
      const partMeta = partUrls.find((p) => p.partNumber === partNumber);
      if (!partMeta) throw new Error(`Missing presigned URL for part ${partNumber}`);

      const start = i * part_size_bytes;
      const end = Math.min(file.size, start + part_size_bytes);
      const chunk = file.slice(start, end);

      const etag = await uploadChunkWithRetry({
        chunk,
        uploadUrl: partMeta.uploadUrl,
        partNumber,
        onProgress: (loadedBytes) => {
          partProgress[i] = loadedBytes;
          updateOverallProgress();
        },
        maxRetries: 3,
      });

      partProgress[i] = chunk.size;
      updateOverallProgress();

      uploadedParts.push({
        PartNumber: partNumber,
        ETag: etag,
      });
    }

    // 5. Complete multipart upload on backend & enqueue transcoding
    const completeRes = await api.post("/videos/complete", {
      video_id,
      parts: uploadedParts,
    });

    return {
      videoId: video_id,
      status: completeRes.data?.data?.status || "uploaded",
      duration,
    };
  } catch (uploadErr) {
    // Attempt abort on failure to prevent orphaned S3 parts
    try {
      await api.post("/videos/abort", { video_id });
    } catch (abortErr) {
      console.warn("Failed to abort multipart upload:", abortErr.message);
    }
    throw uploadErr;
  }
}

