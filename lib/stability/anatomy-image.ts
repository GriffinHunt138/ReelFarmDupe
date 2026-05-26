/**
 * anatomy-image.ts
 *
 * Generates reference PNGs for Higgsfield kling animation.
 *
 * Flow (with user reference photo):
 *   User photo → Sharp (resize + composite onto dark navy 1080×1080) → Higgsfield CDN
 *
 * Flow (text-only fallback — no reference photo):
 *   Claude text (SVG) → sharp (PNG) → Higgsfield CDN
 *
 * Color language (fallback SVG only):
 *   BLUE  (#a8d8ff)  = bone, healthy anatomy
 *   BEIGE (#e8c882)  = nerve roots, nerve tissue
 *   RED   (#e63030)  = damage, compression, stress, pain
 *   CYAN  (#5ce1ff)  = force arrows, direction indicators
 */

import path from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import axios from 'axios';

const IMAGE_SIZE = 1080;

// ─── Art direction constants ──────────────────────────────────────────────────

const STYLE_GUIDE = `
ILLUSTRATION STYLE: 3D medical textbook meets Kurzgesagt animation — bold, rounded, slightly
cartoony, clearly showing what is happening. Think: a frame from a high-quality medical
explainer video. Clean, visually striking, immediately understandable.

3D DEPTH RULES (important — create volume, not flat shapes):
- Every bone/structure has THREE layers of gradients:
    1. Top highlight: lighter color (top edge of shape)
    2. Body fill: main color (middle)
    3. Shadow base: darker color (bottom edge of shape)
- Add a thin white specular line (1-2px, 60-80% opacity) along the top-lit edge of each bone
- Background elements are darker/smaller; foreground elements are brighter/larger
- Overlapping shapes create depth — don't leave everything at the same z-level

COMPOSITION:
- The anatomy is the HERO — it should fill 60-75% of the 1080×1080 canvas
- Center the composition with roughly equal breathing room on all sides
- The main action/feature (compression, nerve, muscle group) is the FOCAL POINT — make it unmistakable
- Use scale contrast: the key feature is biggest/brightest, supporting anatomy is smaller/dimmer
`;

const COLOR_PALETTE = `
COLOR PALETTE — use exactly these hex values. The color = the meaning.

Background:
  Deep navy:           #050c1a
  Background glow:     #0e1e38 (center of radialGradient behind anatomy)

BLUE = Bone / Healthy anatomy:
  Bone highlight top:  #d4edff
  Bone main:           #a8d8ff
  Bone shadow bottom:  #5a9bc0
  Bone specular:       #ffffff (thin top-edge stroke, 70% opacity)
  Endplate/joint:      #7ab8e0
  Cartilage:           #8ec4e8

BEIGE = Nerve roots / Nerve tissue (NOT blue — nerve is warm beige/yellow):
  Nerve highlight:     #f0d8a8
  Nerve main:          #e8c882
  Nerve shadow:        #c8a060
  Nerve brightest:     #f5e4b0 (hottest point — active/compressed location)

RED = Damage / Stress / Pain (anything WRONG uses red):
  Damage mild:         #e63030
  Damage peak:         #ff4444  (maximum compression or pain point — brightest red)
  Damage deep:         #cc1a1a  (chronic/severe — darkest red)
  Stress glow:         #ff6666  (radiating halo around damaged areas)

CYAN-BLUE = Force arrows / Direction indicators (distinct from bone blue):
  Arrow main:          #5ce1ff
  Arrow glow:          #7eeeff

Muscle:
  Muscle body:         #89c4e1 (slightly more teal than bone)
  Muscle striation:    #5a9fc4
  Muscle highlight:    #b8dff0

Secondary structures:
  Depth/shadow:        #2a5070 (far-back elements)
  Supporting anatomy:  #4a7090 (mid-ground elements)
  Ligament/tendon:     #6ba8cc

Background details:
  Grid lines (v faint): #0a1830
  Depth shadow:         #020810 (deepest shadows)
`;

const SVG_TECHNIQUES = `
REQUIRED SVG TECHNIQUES:

1. Background with radial glow behind anatomy:
   <radialGradient id="bgGlow" cx="50%" cy="50%" r="45%">
     <stop offset="0%" stop-color="#0e1e38"/>
     <stop offset="100%" stop-color="#050c1a"/>
   </radialGradient>

2. 3D bone gradient (apply to each vertebra/bone shape):
   <linearGradient id="boneGrad" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0%" stop-color="#d4edff"/>
     <stop offset="35%" stop-color="#a8d8ff"/>
     <stop offset="100%" stop-color="#5a9bc0"/>
   </linearGradient>

3. Stress/damage glow filter — RED, apply to ALL damaged areas:
   <filter id="stressGlow" x="-30%" y="-30%" width="160%" height="160%">
     <feGaussianBlur stdDeviation="18" result="blur"/>
     <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
   </filter>
   → Use on red shapes: filter="url(#stressGlow)"
   → The blur creates a red glow halo around damaged areas

4. Drop shadow — makes anatomy float/hover (apply to all main anatomy elements):
   <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
     <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000010" flood-opacity="0.45"/>
   </filter>

5. Soft anatomy glow (apply to healthy anatomy elements):
   <filter id="softGlow" x="-15%" y="-15%" width="130%" height="130%">
     <feGaussianBlur stdDeviation="6" result="blur"/>
     <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
   </filter>

6. Nerve glow — warm beige halo (apply to nerve tissue elements):
   <filter id="nerveGlow" x="-20%" y="-20%" width="140%" height="140%">
     <feGaussianBlur stdDeviation="7" result="blur"/>
     <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
   </filter>

7. White specular edge line on each bone (thin <path> with white stroke, no fill, opacity 0.7)

8. Force arrows: filled polygon arrowheads + stroke lines in #5ce1ff, filter softGlow
`;

// ─── Per-category drawing instructions ───────────────────────────────────────

const CATEGORY_DRAW_GUIDE: Record<string, string> = {

  vertebral: `
HOW TO DRAW VERTEBRAE:
Each lumbar vertebra is a rounded rectangular body (the "block") with:
- Main vertebral body: a wide rounded rectangle, roughly 300px wide, 130px tall, corners radius ~20px
  → Fill with boneGrad (lighter top to darker bottom), filter="url(#dropShadow)"
  → White specular line along top edge
- Top and bottom endplates: slightly darker flat ellipses (#7ab8e0), 5-8px thick
- Transverse processes: two curved "wings" extending left and right from the mid-height
  → Each wing is a rounded rectangle, 80px wide, 40px tall, slightly rotated outward
  → Same bone gradient, slightly smaller/thinner than vertebral body
- Spinal canal hint: small dark oval (#020810) centered in the back of the vertebral body
- Stack 3 vertebrae vertically with ~30px gaps between them

HOW TO DRAW INTERVERTEBRAL DISCS:
Each disc sits in the gap between two vertebrae:
- Shape: flat ellipse, roughly same width as vertebral body (280px wide), 35-45px tall when HEALTHY
- HEALTHY disc: radialGradient center #b8dde8 to edge #7ab8e0 (blue — it is normal anatomy)
- COMPRESSED/DAMAGED disc: RED (#e63030 to #ff4444 center) with filter="url(#stressGlow)"
  → A damaged disc is flatter (20-25px tall), may bulge slightly sideways
  → The bulge point is the BRIGHTEST red (#ff4444)

FORCE ARROWS (for compression):
- Show 2-3 downward arrows above the top vertebra in #5ce1ff
- Show 1-2 upward arrows below the bottom vertebra in #5ce1ff
- Arrows: thick stroke (~6px) with filled arrowhead polygon
- Apply filter="url(#softGlow)" to all arrows
`,

  muscle: `
HOW TO DRAW SPINAL MUSCLES:
- Muscles run vertically along the spine — show them as elongated rounded forms on each side
- Each muscle bundle: a tall tapered shape, widest in the middle, narrowing at top and bottom
- Muscle gradient: top lighter (#b8dff0), bottom darker (#5a9fc4), filter="url(#dropShadow)"
- Add parallel diagonal striation lines (3-5px wide paths, #5a9fc4, 60% opacity) along the length
  → These striation lines give the muscle texture and make it clearly identifiable as muscle
- Show 2-3 muscle layers of slightly different sizes (deepest = darkest, most superficial = brightest)
- The spine runs down the center between the left and right muscle groups
- DAMAGED/TIGHT muscle: show that section in red (#e63030) with stressGlow filter
`,

  nerve: `
HOW TO DRAW NERVES (BEIGE/WARM — not blue):
- Nerve roots and nerve tissue use WARM BEIGE/YELLOW — this distinguishes them from bone (blue)
- Main nerve trunk: a curved path, 12-18px stroke width, color #e8c882
- Apply filter="url(#nerveGlow)" to all nerve paths for a warm organic glow
- Branch points where smaller nerves split off: show as Y-junctions
- Active/healthy nerve: color #e8c882 with nerveGlow
- COMPRESSED nerve: show that section in RED (#e63030) with stressGlow filter
  → The compression point glows red/bright — the nerve is being pinched
- The spinal cord itself: a thicker path (20-25px) running center, color #e8c882
- Where nerve exits foramen: show the foramen as a gap between blue vertebrae, beige nerve passing through
- Nerve endings: small warm dots (#f5e4b0) with nerveGlow
`,

  ligament: `
HOW TO DRAW LIGAMENTS:
- Ligaments are STRAPS connecting bone to bone — show them as flat, fibrous bands
- Color: #6ba8cc (blue-steel), semi-transparent (80% opacity), filter="url(#dropShadow)"
- Add subtle longitudinal fiber lines (fine dashed strokes along the length)
- Ligament bands are thinner than bones (15-30px wide) but clearly span between attachment points
- Show attachment points as slightly wider flared ends where ligament meets bone
- The posterior longitudinal ligament runs along the BACK of the vertebral bodies
- DAMAGED ligament: show it in red (#e63030) with stressGlow
`,

  posture: `
HOW TO DRAW FULL SPINE SILHOUETTE:
- Draw the full spine as a SIDE PROFILE (lateral view)
- Show the spine as a curved chain of vertebrae from mid-back to pelvis (~7-8 vertebrae)
- Each vertebra in side view: compact rounded rectangles stacked at slight angles, filter="url(#dropShadow)"
- The spine's natural S-curve (or deviation from it) is the HERO — make the curve visually dramatic
- Show pelvis as a large curved bone at the bottom (wide rounded triangle)
- For lordosis/kyphosis: exaggerate the curve to make it visually clear
- Alignment guide: a thin vertical dotted line (#2a5070, dashed) to show deviation
- STRESSED vertebrae at the curve apex: use red (#e63030) with stressGlow
`,

  movement: `
HOW TO DRAW SPINAL MOVEMENT:
- Movement is shown through MOTION TRAILS and POSITION COMPARISON
- Draw the spine in its current position (solid, full color) AND a ghost position (same shapes, 35% opacity)
- Motion arc lines: curved paths showing the trajectory (#a8d8ff, 40% opacity, no fill, 3px stroke)
- For flexion: forward-bent position is solid, neutral is ghost
- For rotation: rotated position is solid, neutral is ghost
- Add 3-5 speed lines (thin curved paths, #5ce1ff, 50% opacity) following direction of motion
- Joint pivot points: small bright circles (#d4edff) at center of rotation, filter="url(#softGlow)"
- Motion direction arrows: #5ce1ff with filter="url(#softGlow)"
`,

  circulation: `
HOW TO DRAW FLUID/CIRCULATION:
- Fluid flow is shown as ANIMATED-LOOKING PATHS with flow lines entering the disc
- Disc nutrition: show the disc as a central oval with flow lines entering from the endplates
- Flow lines: curved paths with arrowhead terminators, color #5ce1ff (healthy flow)
- For INFLAMMATION: show the stressed area with a RED GLOW radiating outward
  → Use a radialGradient from #e63030 center to transparent for the inflammation halo
  → Apply stressGlow filter to the disc/tissue
- For healing: show cool blue flow (#5ce1ff) moving INTO the disc, red glow fading outward
- The disc's internal structure: show the nucleus pulposus as a brighter inner oval
- Healthy nucleus: light blue (#b8dde8); inflamed nucleus: red (#ff4444) with stressGlow
`,
};

// ─── Dark navy composite ──────────────────────────────────────────────────────
// Resizes the user's reference photo and centers it on a 1080×1080 dark navy
// canvas. Anatomy colors are preserved exactly — only the background changes.

async function compositeOnDarkBackground(inputPath: string, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Get final dimensions after resize
  const { info } = await sharp(inputPath)
    .resize(960, 960, { fit: 'inside', withoutEnlargement: false })
    .toBuffer({ resolveWithObject: true });

  const left = Math.round((1080 - info.width) / 2);
  const top  = Math.round((1080 - info.height) / 2);

  // Re-encode as PNG for composite (avoids raw channel mismatch with sharp)
  const resizedPng = await sharp(inputPath)
    .resize(960, 960, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 1080, height: 1080, channels: 4, background: { r: 5, g: 12, b: 26, alpha: 1 } },
  })
    .composite([{ input: resizedPng, left, top }])
    .png({ quality: 95 })
    .toFile(outputPath);
}

// ─── Find user-supplied reference image ──────────────────────────────────────
// Checks reference-input/ for a flat file matching clipId, OR an image inside
// a folder named after the clip (for custom clips).

export function findReferenceImage(clipId: string): string | null {
  const refDir = path.join(process.cwd(), 'reference-input');
  if (!fs.existsSync(refDir)) return null;

  const exts = ['jpg', 'jpeg', 'png', 'webp'];

  // 1. Flat file: reference-input/{clipId}.{ext}
  for (const ext of exts) {
    const p = path.join(refDir, `${clipId}.${ext}`);
    if (fs.existsSync(p)) return p;
  }

  // 2. Folder: reference-input/{clipId}/{any-image}
  //    Also handles custom clip folders where clipId = folder name
  const folderPath = path.join(refDir, clipId);
  if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
    // Prefer named files first
    const preferredNames = ['image', 'reference', 'ref', 'photo'];
    for (const name of preferredNames) {
      for (const ext of exts) {
        const p = path.join(folderPath, `${name}.${ext}`);
        if (fs.existsSync(p)) return p;
      }
    }
    // Fall back to first image file found
    try {
      const files = fs.readdirSync(folderPath);
      for (const f of files) {
        if (/\.(jpg|jpeg|png|webp)$/i.test(f)) {
          return path.join(folderPath, f);
        }
      }
    } catch { /* ignore */ }
  }

  return null;
}

// ─── Text-only SVG generation (fallback — no reference image) ────────────────

export async function generateAnatomySvg(
  label: string,
  category: string,
  tags: string[],
  contentDescription: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const categoryGuide = CATEGORY_DRAW_GUIDE[category] ?? CATEGORY_DRAW_GUIDE.vertebral;

  const prompt = `You are a medical illustrator creating a single high-quality SVG illustration for a health education app.

SUBJECT: "${label}"
WHAT THIS SHOWS: ${contentDescription}
KEY ANATOMY: ${tags.join(', ')}

${STYLE_GUIDE}

${COLOR_PALETTE}

${SVG_TECHNIQUES}

${categoryGuide}

NOW DRAW: "${label}"
${contentDescription.toUpperCase()}

Specific guidance for THIS illustration:
- The primary subject is: ${label}
- The KEY VISUAL FEATURE that must be unmistakably clear: ${tags[0]} and ${tags[1] ?? tags[0]}
- If this involves stress/damage/compression: use RED (#e63030, #ff4444) prominently with stressGlow filter
- If this involves a nerve: use BEIGE (#e8c882, #f0d8a8) with nerveGlow filter
- If this involves movement/posture: show the position clearly with good composition
- Force/compression arrows use CYAN #5ce1ff
- Make the illustration INSTANTLY READABLE — someone should understand what body part and action within 2 seconds

CANVAS: viewBox="0 0 1080 1080" width="1080" height="1080"

FINAL CHECKLIST before outputting:
✓ Anatomy fills 60-75% of canvas (not tiny floating shapes)
✓ 3D gradient on every bone/structure (not flat fills)
✓ The main action/feature is visually dominant
✓ Damaged/stressed areas use RED with stressGlow
✓ Nerve tissue uses BEIGE with nerveGlow
✓ Background has radial glow behind anatomy
✓ Drop shadow on all main anatomy (floating feel)
✓ NO text, labels, arrows with text, or annotations

Return ONLY the complete SVG. Start with <svg and end with </svg>. No markdown fences.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const match = raw.match(/<svg[\s\S]*<\/svg>/);
  if (!match) throw new Error(`Claude did not return valid SVG for "${label}"`);
  return match[0];
}

// ─── SVG → PNG via sharp ──────────────────────────────────────────────────────

export async function renderAnatomyPng(svgCode: string, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svgCode))
    .resize(IMAGE_SIZE, IMAGE_SIZE)
    .png({ quality: 95 })
    .toFile(outputPath);
}

// ─── Upload PNG to Higgsfield CDN ─────────────────────────────────────────────

export async function uploadToHiggsfieldCdn(imagePath: string, mimeType = 'image/png'): Promise<string> {
  const { keyId, secret } = getHiggsfieldCreds();

  const presignRes = await axios.post<{ public_url: string; upload_url: string }>(
    'https://platform.higgsfield.ai/files/generate-upload-url',
    { content_type: mimeType },
    {
      headers: {
        'hf-api-key': keyId,
        'hf-secret':  secret,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    },
  );

  const { public_url, upload_url } = presignRes.data;
  if (!upload_url || !public_url) throw new Error('Higgsfield did not return upload URLs');

  const buffer = fs.readFileSync(imagePath);
  await axios.put(upload_url, buffer, {
    headers: { 'Content-Type': mimeType },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 60_000,
  });

  return public_url;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function prepareReferenceImage(
  clipId: string,
  label: string,
  category: string,
  tags: string[],
  refPngPath: string,
  contentDescription = '',
  userReferenceImagePath?: string,
): Promise<string> {
  // Cached PNG already exists — just re-upload
  if (fs.existsSync(refPngPath)) {
    return uploadToHiggsfieldCdn(refPngPath);
  }

  if (userReferenceImagePath) {
    // Composite photo onto dark navy 1080×1080 canvas, cache as refPngPath, then upload
    console.log(`[anatomy-image] Compositing reference photo for ${clipId} onto dark navy canvas`);
    await compositeOnDarkBackground(userReferenceImagePath, refPngPath);
    return uploadToHiggsfieldCdn(refPngPath);
  } else {
    // Text-only fallback: Claude generates SVG → sharp renders PNG
    const svg = await generateAnatomySvg(label, category, tags, contentDescription);
    await renderAnatomyPng(svg, refPngPath);
  }

  return uploadToHiggsfieldCdn(refPngPath);
}

// ─── Credential helper ────────────────────────────────────────────────────────

export function getHiggsfieldCreds(): { keyId: string; secret: string } {
  const raw = process.env.HIGGSFIELD_API_KEY;
  if (!raw) throw new Error('HIGGSFIELD_API_KEY not set. Get credentials at https://platform.higgsfield.ai → Settings → API Keys');
  const colonIdx = raw.indexOf(':');
  if (colonIdx !== -1) return { keyId: raw.slice(0, colonIdx), secret: raw.slice(colonIdx + 1) };
  const toUUID = (h: string) =>
    `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  return { keyId: toUUID(raw.slice(0, 32)), secret: raw.slice(32) };
}
