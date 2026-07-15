import { env } from "@contract-builder/env/server";

/**
 * Thin client for Cloudflare Images. Used as the storage for template preview
 * photos: the server compiles a PNG once, uploads it here, and the browser
 * loads it straight from imagedelivery.net (cached on Cloudflare's edge)
 * instead of pulling base64 blobs out of Postgres.
 *
 * Everything is optional-config: when the env keys are missing (or the token
 * is revoked) callers fall back to the legacy base64-in-DB cache, so a broken
 * Cloudflare setup can never take previews down.
 */

const API_BASE = "https://api.cloudflare.com/client/v4";
// Uploads happen inside a user-facing request (first photo view after an
// admin edit) — better to fall back to serving bytes than to hang.
const UPLOAD_TIMEOUT_MS = 15_000;

export function cloudflareImagesConfigured(): boolean {
  return Boolean(
    env.CLOUDFLARE_ACCOUNT_ID &&
      env.CLOUDFLARE_IMAGES_ACCOUNT_HASH &&
      env.CLOUDFLARE_IMAGES_API_TOKEN
  );
}

/**
 * Delivery URLs only need the account hash — kept separate from the full
 * upload config so previously stored image ids don't turn into
 * `imagedelivery.net/undefined/…` redirects when the token is rotated out.
 */
export function cloudflareDeliveryConfigured(): boolean {
  return Boolean(env.CLOUDFLARE_IMAGES_ACCOUNT_HASH);
}

/** Public delivery URL for an uploaded image id. */
export function cloudflareImageUrl(imageId: string): string {
  return `https://imagedelivery.net/${env.CLOUDFLARE_IMAGES_ACCOUNT_HASH}/${imageId}/${env.CLOUDFLARE_IMAGES_VARIANT}`;
}

interface UploadResponse {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: { id: string };
}

/**
 * Uploads a PNG and returns its Cloudflare image id.
 * Throws with the API's error text on any failure — callers decide the
 * fallback (we never want a failed upload to 500 a preview request).
 */
export async function uploadCloudflareImage(
  png: Buffer,
  metadata?: Record<string, string>
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }));
  if (metadata) {
    form.append("metadata", JSON.stringify(metadata));
  }
  const response = await fetch(
    `${API_BASE}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_IMAGES_API_TOKEN}` },
      body: form,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    }
  );
  const data = (await response.json()) as UploadResponse;
  if (!(data.success && data.result?.id)) {
    const reason =
      data.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ??
      `HTTP ${response.status}`;
    throw new Error(`Cloudflare Images upload failed (${reason})`);
  }
  return data.result.id;
}

/**
 * Best-effort delete of replaced/orphaned images — a leaked image only costs
 * pennies, so failures are logged and swallowed.
 */
export async function deleteCloudflareImage(imageId: string): Promise<void> {
  if (!cloudflareImagesConfigured()) {
    return;
  }
  try {
    const response = await fetch(
      `${API_BASE}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1/${imageId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_IMAGES_API_TOKEN}` },
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      }
    );
    // fetch resolves on HTTP errors (revoked token → 401) — without this
    // check replaced images would leak with zero log signal. 404 is fine:
    // already gone.
    if (!(response.ok || response.status === 404)) {
      const body = await response.text().catch(() => "");
      console.error(
        `Cloudflare Images: delete ${imageId} returned ${response.status}: ${body.slice(0, 300)}`
      );
    }
  } catch (error) {
    console.error(
      `Cloudflare Images: failed to delete ${imageId}:`,
      error instanceof Error ? error.message : error
    );
  }
}

// preview_images values are either a Cloudflare image id (short) or a legacy
// base64 PNG blob (hundreds of KB). Ids are UUID-ish and never anywhere near
// this long.
const MAX_IMAGE_ID_LENGTH = 256;

export function isCloudflareImageId(cached: string): boolean {
  return cached.length <= MAX_IMAGE_ID_LENGTH;
}
