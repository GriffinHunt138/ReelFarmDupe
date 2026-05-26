/**
 * higgsfield.ts
 *
 * Higgsfield platform adapter (platform.higgsfield.ai — image2video/kling).
 *
 * Auth: hf-api-key (UUID) + hf-secret headers.
 * HIGGSFIELD_API_KEY env var: "KEY_ID:KEY_SECRET" (colon-separated, from your dashboard)
 *
 * The caller is responsible for providing a reference image URL (CDN-hosted PNG).
 * Use anatomy-image.ts to generate + upload the reference frame before calling here.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getHiggsfieldCreds } from '@/lib/stability/anatomy-image';

const BASE = 'https://platform.higgsfield.ai';

// Appended to every kling generation — quality + color fidelity only.
// Background, motion type, and zoom are all controlled per-clip via the clip prompt field.
const MOTION_PROMPT =
  'preserve exact colors of the subject do not alter spread or hallucinate any colors, ' +
  'smooth motion no abrupt cuts, clinical medical visualization';

// ── Response shapes ────────────────────────────────────────────────────────────

interface SubmitResponse {
  id: string;            // job-set ID — used for polling
  type: string;
  jobs: Array<{ id: string; status: string; results: unknown }>;
}

interface StatusResponse {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw';
  request_id: string;
  video?: { url: string };
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Animate a reference image into a ~5s video using Higgsfield kling.
 *
 * @param motionPrompt  Describes the camera / motion — MOTION_PROMPT is appended.
 * @param referenceImageUrl  Public HTTPS URL of the reference PNG (Higgsfield CDN).
 * @param outputPath    Local path to write the downloaded .mp4.
 */
export async function generateBackgroundVideo(
  motionPrompt: string,
  _duration: number,
  outputPath: string,
  referenceImageUrl?: string,
): Promise<void> {
  if (!referenceImageUrl) {
    throw new Error(
      'generateBackgroundVideo requires a referenceImageUrl. ' +
      'Call prepareReferenceImage() first to get a Higgsfield CDN URL.',
    );
  }

  const { keyId, secret } = getHiggsfieldCreds();
  const headers = {
    'hf-api-key': keyId,
    'hf-secret':  secret,
    'Content-Type': 'application/json',
  };

  // ── Step 1: Submit image2video/kling ────────────────────────────────────────
  const submitRes = await axios.post<SubmitResponse>(
    `${BASE}/v1/image2video/kling`,
    {
      params: {
        prompt: `${motionPrompt}, ${MOTION_PROMPT}`,
        input_image: {
          type: 'image_url',
          image_url: referenceImageUrl,
        },
        // kling defaults: model=kling-v2-1, mode=pro, duration=5, cfg_scale=0.5
      },
    },
    { headers, timeout: 30_000 },
  );

  const jobSetId = submitRes.data.id;
  if (!jobSetId) throw new Error('Higgsfield did not return a job set ID');

  // ── Step 2: Poll /requests/{id}/status until completed ──────────────────────
  const deadline = Date.now() + 8 * 60 * 1000; // 8 min max

  while (Date.now() < deadline) {
    await sleep(10_000);

    const pollRes = await axios.get<StatusResponse>(
      `${BASE}/requests/${jobSetId}/status`,
      { headers, timeout: 15_000 },
    );

    const { status, video } = pollRes.data;

    if (status === 'failed' || status === 'nsfw') {
      throw new Error(`Higgsfield generation ${status} for job ${jobSetId}`);
    }

    if (status === 'completed' && video?.url) {
      await downloadVideo(video.url, outputPath);
      return;
    }
  }

  throw new Error(`Higgsfield timed out after 8 minutes (job ${jobSetId})`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function downloadVideo(url: string, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 120_000,
  });
  fs.writeFileSync(outputPath, Buffer.from(res.data));
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
