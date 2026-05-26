import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { anatomyClips } from '@/lib/db';
import type { AnatomyCategory } from '@/lib/stability/types';
import { prepareReferenceImage, findReferenceImage } from '@/lib/stability/anatomy-image';

const execFileAsync = promisify(execFile);

// ─── Visual style lock ────────────────────────────────────────────────────────
// Appended to every Higgsfield prompt so all clips look like one visual system.

export const STYLE_SUFFIX =
  'dark navy background, clean minimal 3d medical render, ' +
  'soft cool blue-white glow on anatomy, ' +
  'smooth slow deliberate camera movement, ' +
  'subtle ambient rim lighting, no text no labels, ' +
  'calm clinical aesthetic, seamless loop-friendly motion';

// ─── Seed clip definitions ────────────────────────────────────────────────────

interface SeedClip {
  id: string;
  category: AnatomyCategory;
  tags: string[];
  label: string;
  content: string;  // anatomy content — STYLE_SUFFIX is appended at generation time
}

export const SEED_CLIPS: SeedClip[] = [
  // ── vertebral (4) ──────────────────────────────────────────────────────────
  {
    id: 'vertebral_lumbar_stack_01',
    category: 'vertebral',
    tags: ['lumbar', 'vertebrae', 'spine', 'stack'],
    label: 'Lumbar Vertebral Stack',
    content: 'lumbar vertebral column stack slow rotating orbit close-up',
  },
  {
    id: 'vertebral_disc_compress_01',
    category: 'vertebral',
    tags: ['lumbar', 'disc', 'compression', 'load'],
    label: 'Lumbar Disc Compression',
    content: 'lumbar vertebrae disc compression under load close-up slow zoom',
  },
  {
    id: 'vertebral_disc_herniation_01',
    category: 'vertebral',
    tags: ['disc', 'herniation', 'nucleus', 'bulge'],
    label: 'Disc Herniation',
    content: 'intervertebral disc herniation nucleus pulposus bulging slow zoom',
  },
  {
    id: 'vertebral_facet_joint_01',
    category: 'vertebral',
    tags: ['facet', 'joint', 'lumbar', 'articulation'],
    label: 'Facet Joint Articulation',
    content: 'lumbar facet joints highlighted slow orbit anatomy close-up',
  },

  // ── muscle (4) ─────────────────────────────────────────────────────────────
  {
    id: 'muscle_erector_spinae_01',
    category: 'muscle',
    tags: ['erector', 'spinae', 'paraspinal', 'back'],
    label: 'Erector Spinae',
    content: 'erector spinae muscles highlighted along spine slow camera pull-back',
  },
  {
    id: 'muscle_psoas_01',
    category: 'muscle',
    tags: ['psoas', 'hip', 'flexor', 'lumbar'],
    label: 'Psoas Major',
    content: 'psoas major muscle highlighted lumbar to femur slow orbit',
  },
  {
    id: 'muscle_deep_core_01',
    category: 'muscle',
    tags: ['core', 'multifidus', 'transversus', 'deep'],
    label: 'Deep Core Muscles',
    content: 'deep core muscles multifidus transversus abdominis highlighted slow zoom',
  },
  {
    id: 'muscle_paraspinal_01',
    category: 'muscle',
    tags: ['paraspinal', 'muscle', 'thoracic', 'lumbar'],
    label: 'Paraspinal Muscles',
    content: 'paraspinal muscles thoracic and lumbar region slow pull-back full view',
  },

  // ── nerve (4) ──────────────────────────────────────────────────────────────
  {
    id: 'nerve_sciatic_pathway_01',
    category: 'nerve',
    tags: ['sciatic', 'nerve', 'lumbar', 'pathway'],
    label: 'Sciatic Nerve Pathway',
    content: 'sciatic nerve pathway lumbar to foot slow orbit glowing',
  },
  {
    id: 'nerve_spinal_root_01',
    category: 'nerve',
    tags: ['nerve', 'root', 'foramen', 'exit'],
    label: 'Spinal Nerve Root Exit',
    content: 'lumbar nerve root exiting foramen slow zoom close-up',
  },
  {
    id: 'nerve_compression_01',
    category: 'nerve',
    tags: ['nerve', 'compression', 'disc', 'impingement'],
    label: 'Nerve Compression',
    content: 'nerve root compression by herniated disc slow zoom close-up',
  },
  {
    id: 'nerve_dermatome_01',
    category: 'nerve',
    tags: ['dermatome', 'nerve', 'distribution', 'map'],
    label: 'Lumbar Dermatomes',
    content: 'lumbar dermatome nerve distribution map slow reveal orbit',
  },

  // ── ligament (3) ───────────────────────────────────────────────────────────
  {
    id: 'ligament_posterior_longitudinal_01',
    category: 'ligament',
    tags: ['posterior', 'longitudinal', 'ligament', 'spine'],
    label: 'Posterior Longitudinal Ligament',
    content: 'posterior longitudinal ligament spinal anatomy slow zoom',
  },
  {
    id: 'ligament_flavum_01',
    category: 'ligament',
    tags: ['ligamentum', 'flavum', 'canal', 'spinal'],
    label: 'Ligamentum Flavum',
    content: 'ligamentum flavum highlighted spinal canal slow orbit',
  },
  {
    id: 'ligament_sacroiliac_01',
    category: 'ligament',
    tags: ['sacroiliac', 'joint', 'pelvis', 'ligament'],
    label: 'Sacroiliac Joint',
    content: 'sacroiliac joint ligaments highlighted pelvis slow zoom',
  },

  // ── posture (4) ────────────────────────────────────────────────────────────
  {
    id: 'posture_lordosis_01',
    category: 'posture',
    tags: ['lordosis', 'neutral', 'lumbar', 'alignment'],
    label: 'Lordosis vs Neutral Spine',
    content: 'lumbar lordosis versus neutral spine alignment comparison slow pull-back',
  },
  {
    id: 'posture_flat_back_01',
    category: 'posture',
    tags: ['flat', 'back', 'lumbar', 'posture'],
    label: 'Flat Back Posture',
    content: 'flat back posture lumbar spine reduced curve slow orbit',
  },
  {
    id: 'posture_forward_head_01',
    category: 'posture',
    tags: ['forward', 'head', 'cervical', 'posture'],
    label: 'Forward Head Posture',
    content: 'forward head posture cervical spine stress slow zoom side view',
  },
  {
    id: 'posture_kyphosis_01',
    category: 'posture',
    tags: ['kyphosis', 'thoracic', 'curve', 'posture'],
    label: 'Thoracic Kyphosis',
    content: 'thoracic kyphosis excessive curve slow side orbit',
  },

  // ── movement (3) ───────────────────────────────────────────────────────────
  {
    id: 'movement_flexion_01',
    category: 'movement',
    tags: ['flexion', 'lumbar', 'spine', 'bending'],
    label: 'Lumbar Flexion',
    content: 'lumbar spine flexion mechanics slow motion bending forward',
  },
  {
    id: 'movement_extension_01',
    category: 'movement',
    tags: ['extension', 'lumbar', 'spine', 'backward'],
    label: 'Lumbar Extension',
    content: 'lumbar spine extension mechanics slow motion backward bend',
  },
  {
    id: 'movement_rotation_01',
    category: 'movement',
    tags: ['rotation', 'lumbar', 'spine', 'twist'],
    label: 'Lumbar Rotation',
    content: 'lumbar spine rotation mechanics slow motion axial twist',
  },

  // ── circulation (3) ────────────────────────────────────────────────────────
  {
    id: 'circulation_disc_nutrition_01',
    category: 'circulation',
    tags: ['disc', 'nutrition', 'diffusion', 'hydration'],
    label: 'Disc Nutrition & Hydration',
    content: 'intervertebral disc nutrition diffusion fluid exchange slow zoom',
  },
  {
    id: 'circulation_inflammation_01',
    category: 'circulation',
    tags: ['inflammation', 'spinal', 'tissue', 'response'],
    label: 'Spinal Inflammation',
    content: 'spinal tissue inflammation response warm glow slow zoom',
  },
  {
    id: 'circulation_healing_01',
    category: 'circulation',
    tags: ['healing', 'repair', 'tissue', 'recovery'],
    label: 'Tissue Healing',
    content: 'spinal tissue healing repair process slow zoom close-up',
  },
];

// ─── Paths ────────────────────────────────────────────────────────────────────

export function clipDir(id: string): string {
  return path.join(process.cwd(), 'outputs', 'anatomy-clips', id);
}

export function clipVideoPath(id: string): string {
  return path.join(clipDir(id), 'clip.mp4');
}

export function clipThumbPath(id: string): string {
  return path.join(clipDir(id), 'thumb.jpg');
}

// ─── Thumbnail extraction ─────────────────────────────────────────────────────

export async function extractThumbnail(videoPath: string, thumbPath: string): Promise<void> {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  await execFileAsync(ffmpeg, [
    '-y', '-i', videoPath,
    '-vframes', '1',
    '-q:v', '3',
    thumbPath,
  ]);
}

// ─── Custom clip meta (optional sidecar JSON) ─────────────────────────────────
// Drop a meta.json alongside your reference image in reference-input/{folder}/
// to control label, category, tags, and animation prompt.
//
// Example reference-input/cat_cow/meta.json:
// {
//   "label": "Cat Cow Stretch",
//   "category": "movement",
//   "tags": ["flexion", "extension", "thoracic", "lumbar", "mobility"],
//   "prompt": "cat cow yoga stretch spinal mobility slow motion"
// }

interface CustomClipMeta {
  label?: string;
  category?: AnatomyCategory;
  tags?: string[];
  prompt?: string;
}

// Convert a folder/file slug to a readable label: "cat_cow" → "Cat Cow"
function slugToLabel(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Scan custom clip folders ─────────────────────────────────────────────────
// Reads reference-input/ for subdirectories that contain at least one image.
// Registers any unknown clip IDs in the DB as pending.
// Safe to call repeatedly — idempotent.

export function scanCustomClips(): void {
  const refDir = path.join(process.cwd(), 'reference-input');
  if (!fs.existsSync(refDir)) return;

  const seedIds = new Set(SEED_CLIPS.map(c => c.id));

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(refDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const folderName = entry.name;
    const clipId = folderName;

    // Skip if this is a seed clip folder (seed clips are handled by seedClipDefinitions)
    if (seedIds.has(clipId)) continue;

    // Must contain at least one image
    const folderPath = path.join(refDir, folderName);
    let hasImage = false;
    try {
      const files = fs.readdirSync(folderPath);
      hasImage = files.some(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    } catch { continue; }

    if (!hasImage) continue;

    // Already in DB? Skip.
    const existing = anatomyClips.get(clipId);
    if (existing) continue;

    // Load meta.json if present
    let meta: CustomClipMeta = {};
    const metaPath = path.join(folderPath, 'meta.json');
    if (fs.existsSync(metaPath)) {
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { /* ignore */ }
    }

    const label    = meta.label    ?? slugToLabel(folderName);
    const category = meta.category ?? 'movement';
    const tags     = meta.tags     ?? folderName.replace(/[-_]/g, ' ').split(' ').filter(Boolean);
    const prompt   = meta.prompt   ?? `${label.toLowerCase()} slow motion close-up, ${STYLE_SUFFIX}`;

    anatomyClips.upsert({
      id: clipId,
      category,
      tags: JSON.stringify(tags),
      label,
      prompt,
      status: 'pending',
      higgsfield_job_id: null,
      video_path: null,
      thumb_path: null,
      duration: null,
      error: null,
    });

    console.log(`[clip-library] Registered custom clip: ${clipId} (${label})`);
  }
}

// ─── Library seeding ──────────────────────────────────────────────────────────
// Idempotent — inserts pending rows for any clips not yet in the DB.

export function seedClipDefinitions(): void {
  for (const clip of SEED_CLIPS) {
    const existing = anatomyClips.get(clip.id);
    if (!existing) {
      anatomyClips.upsert({
        id: clip.id,
        category: clip.category,
        tags: JSON.stringify(clip.tags),
        label: clip.label,
        prompt: `${clip.content}, ${STYLE_SUFFIX}`,
        status: 'pending',
        higgsfield_job_id: null,
        video_path: null,
        thumb_path: null,
        duration: null,
        error: null,
      });
    }
  }

  // Also register any custom clip folders the user has dropped in
  scanCustomClips();
}

// ─── Build orchestration ──────────────────────────────────────────────────────
// Called by POST /api/stability/clips/build — runs sequentially.
//
// Per clip:
//   1. Check reference-input/ for a user-supplied photo for this clip
//   2. Claude vision (if photo found) or text-only SVG → sharp PNG
//   3. PNG uploaded to Higgsfield CDN → returns public URL
//   4. Higgsfield image2video/kling animates → downloads .mp4
//   5. ffmpeg extracts thumbnail → .jpg

export async function buildClipLibrary(ids?: string[]): Promise<number> {
  const { generateBackgroundVideo } = await import('@/lib/stability/higgsfield');

  seedClipDefinitions(); // also calls scanCustomClips()

  const all = anatomyClips.list();
  const targets = ids
    ? all.filter(c => ids.includes(c.id))
    : all.filter(c => c.status === 'pending' || c.status === 'error');

  let count = 0;

  for (const clip of targets) {
    const dir = clipDir(clip.id);
    fs.mkdirSync(dir, { recursive: true });

    const refPngPath = path.join(dir, 'reference.png');
    const videoPath  = clipVideoPath(clip.id);
    const thumbPath  = clipThumbPath(clip.id);
    const tags: string[] = JSON.parse(clip.tags);

    try {
      anatomyClips.update(clip.id, { status: 'generating', error: null });

      // Check for user-supplied reference image
      const userRef = findReferenceImage(clip.id);
      if (userRef) {
        console.log(`[clip-library] Found reference image for ${clip.id}: ${path.basename(userRef)}`);
        // Copy original into clip dir for record-keeping
        const destName = 'source' + path.extname(userRef);
        fs.copyFileSync(userRef, path.join(dir, destName));
      }

      // Get content description — use seed clip's content field if available
      const seedClip = SEED_CLIPS.find(s => s.id === clip.id);
      const contentDesc = seedClip?.content ?? clip.prompt;

      console.log(`[clip-library] Generating reference image for ${clip.id}${userRef ? ' (vision)' : ' (text)'}…`);
      const refImageUrl = await prepareReferenceImage(
        clip.id,
        clip.label,
        clip.category,
        tags,
        refPngPath,
        contentDesc,
        userRef ?? undefined,
      );
      console.log(`[clip-library] Reference image ready: ${refImageUrl}`);

      // Animate with Higgsfield image2video/kling
      console.log(`[clip-library] Animating ${clip.id}…`);
      await generateBackgroundVideo(clip.prompt, 5, videoPath, refImageUrl);

      // Extract thumbnail (non-fatal)
      try {
        await extractThumbnail(videoPath, thumbPath);
      } catch {
        // Cosmetic — continue without thumb
      }

      anatomyClips.update(clip.id, {
        status: 'ready',
        video_path: videoPath,
        thumb_path: fs.existsSync(thumbPath) ? thumbPath : null,
      });
      count++;
      console.log(`[clip-library] ✓ ${clip.id} complete (${count}/${targets.length})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[clip-library] ✗ ${clip.id} failed:`, msg);
      anatomyClips.update(clip.id, { status: 'error', error: msg });
    }
  }

  return count;
}
