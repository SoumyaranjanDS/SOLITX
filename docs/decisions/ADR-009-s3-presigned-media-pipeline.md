# ADR-009: Direct S3 Presigned Uploads and Asynchronous Image Processing Pipeline

## Status
Accepted

## Context
As SOLITX expanded into multimedia post support (photos, avatars, and tweet media), routing multi-megabyte binary uploads through the Express/Node.js API servers introduced severe architectural bottlenecks:
1. **API Server CPU & Memory Exhaustion:** Buffering 10MB–20MB camera photos in RAM or local disk saturated Node.js event loops and depleted heap memory.
2. **Bandwidth Inefficiency:** The API server paid double network transfer costs (uploading from client to API, then API to S3).
3. **Payload Hazards:** Raw camera photos contain sensitive personal metadata (EXIF GPS latitude/longitude coordinates) and uncompressed 4K resolutions ($12\text{MB}$ per photo), threatening mobile feed performance and risking Decompression Bomb memory attacks.

## Decision
We implement a **Direct-to-S3 Presigned Upload Architecture** decoupled from a resilient **Asynchronous Background Processing Pipeline**:

### 1. Direct-to-S3 via Presigned PUT URLs
- The client requests an upload authorization via `POST /api/v1/media/upload-url` providing `mime_type` and `file_size_bytes`.
- The API validates whitelisted MIME types and enforces a 15MB limit.
- Using `@aws-sdk/s3-request-presigner`, the API creates an isolated key `raw/{userId}/{timestamp}_{uuid}.jpg` and signs a 5-minute PUT URL.
- The client streams the binary file **directly to AWS S3**. The API server touches 0 bytes of media payload.

### 2. Two-Phase Commit State Tracking
- The database record starts with `status: 'pending'`.
- When the client finishes uploading, it calls `POST /api/v1/media/confirm`.
- Status transitions to `'processing'`, and a background job is enqueued into `queue:media_processing`.
- If a user abandons an upload, an AWS S3 Lifecycle Rule automatically purges unlinked `raw/` files after 24 hours.

### 3. Worker Optimization Pipeline (`sharp`)
- The background worker pulls jobs reliably via `dequeueReliable()` (`RPOPLPUSH`).
- **Decompression Bomb Protection:** Checks image dimensions before buffer decompression, rejecting images exceeding 25 Megapixels.
- **Privacy Enforcement:** Strips all EXIF camera and GPS metadata.
- **Responsive Variant Generation:**
  - `thumb`: $150 \times 150\text{px}$ square crop WebP (~15KB) for grids and notifications.
  - `feed`: $600\text{px}$ max width WebP (~120KB) for mobile timeline scrolling.
  - `full`: $1200\text{px}$ max width WebP (~350KB) for lightbox display.
- Uploads the 3 variants to `optimized/{userId}/{mediaId}_*.webp` with immutable 1-year cache headers (`Cache-Control: public, max-age=31536000, immutable`).
- Updates PostgreSQL `media` record to `status: 'ready'`.

### 4. CDN Delivery (CloudFront)
- Media is served through CloudFront edge caching (`https://${CLOUDFRONT_DOMAIN}/...`) or fallback S3 endpoint.
- S3 bucket remains private, preventing public enumeration.

## Consequences & Trade-offs
- **Positive:**
  - **Zero Compute Load:** API servers handle $< 1\text{ms}$ JSON requests instead of 15-second multi-megabyte streams.
  - **98% Bandwidth Reduction:** $12\text{MB}$ camera photos compress down to $< 200\text{KB}$ WebP variants, accelerating feed load times.
  - **Privacy & Security:** Complete EXIF metadata removal and pixel flood protection.
- **Negative:**
  - Requires two-step client flow (request URL $\rightarrow$ PUT to S3 $\rightarrow$ confirm).
  - Requires worker CPU capacity for `sharp` image manipulation.
