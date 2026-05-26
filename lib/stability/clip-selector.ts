import fs from 'fs';
import path from 'path';
import { anatomyClips } from '@/lib/db';
import type { AnatomyClipRow } from '@/lib/db';
import type { AnatomyCategory } from '@/lib/stability/types';

/** Minimal scene descriptor used only by the clip-selector (independent of StabilityScene). */
interface ClipSceneHint {
  bg_category: AnatomyCategory;
  bg_tags: string[];
}
import { stabilityJobs } from '@/lib/db';

// ─── Clip selection ───────────────────────────────────────────────────────────

/**
 * Select the best available clip from the library for a given scene.
 *
 * Scoring:
 *   tagScore       = overlap(scene.bg_tags, clip.tags) / scene.bg_tags.length   (0–1)
 *   recencyPenalty = 0.4 if clip was used in one of the last N jobs
 *   finalScore     = tagScore − recencyPenalty
 *
 * Returns null if no ready clips exist (caller falls back to live Higgsfield).
 */
export function selectClipForScene(
  scene: ClipSceneHint,
  usedClipIds: Set<string>,
  recentClipIds: Set<string>,
): AnatomyClipRow | null {
  // 1. Get all ready clips in the scene's category
  let candidates = anatomyClips
    .listByCategory(scene.bg_category)
    .filter(c => c.status === 'ready');

  // 2. If none in category, fall back to any ready clip
  if (candidates.length === 0) {
    candidates = anatomyClips.listReady();
  }

  // 3. Truly none → caller falls back to live Higgsfield
  if (candidates.length === 0) return null;

  // 4. Exclude already-used clips within this video (intra-video uniqueness)
  const available = candidates.filter(c => !usedClipIds.has(c.id));

  // If all candidates are used, relax the constraint (rare edge case)
  const pool = available.length > 0 ? available : candidates;

  // 5. Score each clip
  const sceneTags = scene.bg_tags.map(t => t.toLowerCase());

  const scored = pool.map(clip => {
    const clipTags: string[] = JSON.parse(clip.tags).map((t: string) => t.toLowerCase());
    const overlap = sceneTags.filter(t => clipTags.includes(t)).length;
    const tagScore = sceneTags.length > 0 ? overlap / sceneTags.length : 0;
    const recencyPenalty = recentClipIds.has(clip.id) ? 0.4 : 0;
    return { clip, score: tagScore - recencyPenalty };
  });

  // 6. Pick randomly from top-scoring bucket (within ±0.1 of max score)
  const maxScore = Math.max(...scored.map(s => s.score));
  const topBucket = scored.filter(s => s.score >= maxScore - 0.1);
  const chosen = topBucket[Math.floor(Math.random() * topBucket.length)];

  return chosen.clip;
}

// ─── Recency tracking ─────────────────────────────────────────────────────────

/**
 * Parse bg_clip_id values from the last N completed jobs.
 * Pure in-process — no new DB schema required.
 */
export function getRecentClipIds(jobCount = 10): Set<string> {
  const ids = new Set<string>();
  try {
    const jobs = stabilityJobs.list().slice(0, jobCount);
    for (const job of jobs) {
      if (!job.script) continue;
      try {
        const script = JSON.parse(job.script) as { scenes?: Array<{ bg_clip_id?: string }> };
        for (const scene of script.scenes ?? []) {
          if (scene.bg_clip_id) ids.add(scene.bg_clip_id);
        }
      } catch { /* malformed script — skip */ }
    }
  } catch { /* non-fatal */ }
  return ids;
}

// ─── File copy ────────────────────────────────────────────────────────────────

/**
 * Copy a library clip to the job's bg path so each job is self-contained.
 */
export async function copyClipToBgPath(srcPath: string, destPath: string): Promise<void> {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await fs.promises.copyFile(srcPath, destPath);
}

// ─── Category distribution helper ─────────────────────────────────────────────

export interface CategoryStats {
  category: AnatomyCategory;
  total: number;
  ready: number;
  generating: number;
  pending: number;
  error: number;
}

export function getCategoryStats(): CategoryStats[] {
  const all = anatomyClips.list();
  const categories: AnatomyCategory[] = [
    'vertebral', 'muscle', 'nerve', 'ligament', 'posture', 'movement', 'circulation',
  ];

  return categories.map(cat => {
    const clips = all.filter(c => c.category === cat);
    return {
      category: cat,
      total: clips.length,
      ready: clips.filter(c => c.status === 'ready').length,
      generating: clips.filter(c => c.status === 'generating').length,
      pending: clips.filter(c => c.status === 'pending').length,
      error: clips.filter(c => c.status === 'error').length,
    };
  });
}
