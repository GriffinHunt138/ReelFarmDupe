# Anatomy Clip Library — Stability Rock Optimization

## Context

Currently every video generation fires 5 live Higgsfield API calls (one per scene), each taking 4-5 minutes. This is the dominant bottleneck — the entire job takes ~5-6 minutes and is expensive. The insight is that back-pain anatomy visualizations fall into a small, stable taxonomy. Pre-generating ~25 high-quality clips once and reusing them intelligently:

- Drops generation time from ~5 min → ~45 sec (bottleneck shifts to ElevenLabs TTS)
- Eliminates Higgsfield cost at video-generation time
- Allows curating clip quality before it goes into production
- Uses smart selection to keep videos feeling fresh and non-repetitive

## Architecture

### Three components

1. **Clip library** — SQLite table + local `.mp4` files. Built once, grown incrementally.
2. **Clip selector** — replaces `generateBackgroundVideo()` with a tag-scored, anti-repetition lookup.
3. **Library UI** — tab in MascotSection to build, monitor, and preview clips.

---

## 1. DB Schema — add to `lib/db.ts` migrate()

```sql
CREATE TABLE IF NOT EXISTS anatomy_clips (
  id                TEXT PRIMARY KEY,   -- human slug: "vertebral_lumbar_compress_01"
  category          TEXT NOT NULL,      -- vertebral|muscle|nerve|ligament|posture|movement|circulation
  tags              TEXT NOT NULL,      -- JSON array: ["lumbar","disc","compression"]
  label             TEXT NOT NULL,      -- "Lumbar Disc Compression"
  prompt            TEXT NOT NULL,      -- Higgsfield prompt used to generate it
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending|generating|ready|error
  higgsfield_job_id TEXT,
  video_path        TEXT,
  thumb_path        TEXT,
  duration          REAL,
  error             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Add `AnatomyClipRow` interface and `anatomyClips` helper (same pattern as `stabilityJobs`):
- `upsert()` — INSERT OR REPLACE, idempotent for re-seeding
- `update(id, partial)` — same pattern as existing helpers
- `get(id)`, `list()`, `listByCategory(cat)`, `listReady()`

**Files:** `lib/db.ts`

---

## 2. Type Changes — `lib/stability/types.ts`

Add to `StabilityScene`:
```typescript
bg_category: AnatomyCategory;   // replaces free-form bg_prompt
bg_tags:     string[];          // 2-4 specific anatomy terms
bg_clip_id?: string;            // set at generation time (for recency tracking)
bg_prompt:   string;            // kept as fallback if library empty
```

Add:
```typescript
export type AnatomyCategory =
  'vertebral' | 'muscle' | 'nerve' | 'ligament' | 'posture' | 'movement' | 'circulation';
```

---

## 3. Visual Style Standard — applied to every clip

All 25 clips share a single locked style template so they look like one cohesive visual system.

### `STYLE_SUFFIX` constant (appended to every Higgsfield prompt)

```typescript
export const STYLE_SUFFIX =
  'dark navy background, clean minimal 3d medical render, ' +
  'soft cool blue-white glow on anatomy, ' +
  'smooth slow deliberate camera movement, ' +
  'subtle ambient rim lighting, no text no labels, ' +
  'calm clinical aesthetic, seamless loop-friendly motion';
```

**Color palette enforced:**
- Background: deep navy (`#050c1a`) — dark but not pure black, gives depth
- Primary anatomy highlight: cool blue-white (`#a8d8ff`) — clean and readable
- Tension/pain indicator: muted warm amber (`#e8a44a`) — visible but not alarming
- Secondary structures: desaturated blue-gray (`#4a6080`) — recedes into background

**Animation rules enforced:**
- Camera: slow zoom-in OR slow orbit OR slow pull-back — never cuts
- Highlight: gentle pulse or smooth fade-on — no strobing
- Motion: all movement < 0.5× speed of a typical action clip — calm and authoritative

This suffix is concatenated to every seed prompt and every custom prompt added later. It is a single source of truth — if the style needs updating, change `STYLE_SUFFIX` and regenerate.

---

## 4. Seed Clips — 25 clips across 7 categories

Stored as a constant in `lib/stability/clip-library.ts`. These are generated once. Every prompt = anatomy content + `STYLE_SUFFIX`.

| Category | Count | Anatomy content portion of prompt |
|---|---|---|
| `vertebral` | 4 | `lumbar vertebrae disc compression close-up slow zoom` |
| `muscle` | 4 | `erector spinae muscles highlighted along spine slow camera pull-back` |
| `nerve` | 4 | `sciatic nerve pathway lumbar to foot slow orbit` |
| `ligament` | 3 | `posterior longitudinal ligament spinal anatomy slow zoom` |
| `posture` | 4 | `lumbar lordosis vs neutral spine alignment slow pull-back` |
| `movement` | 3 | `lumbar spine flexion mechanics slow motion` |
| `circulation` | 3 | `spinal tissue inflammation response slow zoom` |

**Full prompts defined as `SEED_CLIPS` array constant** in `lib/stability/clip-library.ts`. IDs are human-readable slugs. The build function concatenates each anatomy content string with `, ${STYLE_SUFFIX}` before submitting to Higgsfield.

File storage: `outputs/anatomy-clips/{id}/clip.mp4` and `thumb.jpg`

Thumbnail extraction (on clip ready):
```bash
ffmpeg -y -i clip.mp4 -vframes 1 -q:v 3 thumb.jpg
```

---

## 4. Clip Selector — `lib/stability/clip-selector.ts`

**`selectClipForScene(scene, usedClipIds, recentClipIds)`**

```
1. Get all ready clips in scene.bg_category
2. If none → fall back to any ready clip
3. If truly none → return null (caller falls back to live Higgsfield)
4. Exclude usedClipIds (intra-video uniqueness)
5. Score each remaining clip:
     tagScore = overlap(scene.bg_tags, clip.tags) / scene.bg_tags.length   (0–1)
     recencyPenalty = recentClipIds.has(clip.id) ? 0.4 : 0
     finalScore = tagScore - recencyPenalty
6. Pick randomly from the top-scoring bucket (±0.1 of max score)
```

**`getRecentClipIds(jobCount)`** — parses `bg_clip_id` from last N jobs' script JSON. Pure in-process, no new DB schema.

**`copyClipToBgPath(srcPath, destPath)`** — `fs.copyFile` wrapper. Each job gets its own copy so outputs are self-contained.

---

## 5. Pipeline Changes — `app/api/stability/generate/route.ts`

**`generateScript()` prompt update:**
- Remove the free-form `bg_prompt` example block
- Add `bg_category` (one of 7 values) + `bg_tags` (2-4 anatomy terms from vocabulary list)
- Keep `bg_prompt` as a fallback field in the JSON output
- Provide the full tag vocabulary as a reference block in the prompt

**`runPipeline()` asset loop:**

Before the parallel loop, run clip selection upfront (sequential, fast — pure DB + JSON):
```typescript
const usedClipIds = new Set<string>();
const recentClipIds = await getRecentClipIds(10);
const selectedClips = scenes.map(scene => {
  const clip = selectClipForScene(scene, usedClipIds, recentClipIds);
  if (clip) usedClipIds.add(clip.id);
  return clip;
});
```

Inside the parallel loop, replace `generateBackgroundVideo`:
```typescript
selectedClips[i]
  ? await copyClipToBgPath(selectedClips[i].video_path!, bgPaths[i])
  : await generateBackgroundVideo(scene.bg_prompt, scene.duration, bgPaths[i])
```

Store `bg_clip_id` on each scene before saving script to DB.

---

## 6. Clip Library API — new routes

```
GET  /api/stability/clips                 — list all anatomy_clips rows
POST /api/stability/clips/build           — seed definitions + trigger batch Higgsfield generation
GET  /api/stability/clips/[id]/video      — stream clip .mp4 (same pattern as /api/stability/video/[id])
GET  /api/stability/clips/[id]/thumb      — serve thumb .jpg
```

`/build` route:
- `POST { all: true }` — upsert all 25 seed definitions, then generate all `pending|error` clips sequentially
- `POST { ids: string[] }` — generate specific clips
- Fire-and-forget: returns `{ count }` immediately; client polls `GET /api/stability/clips`
- Clips generated one at a time (sequential) to avoid hammering Higgsfield

---

## 7. Library UI — `components/ClipLibraryPanel.tsx` + `MascotSection.tsx` tab

**MascotSection** gains a top tab bar: `Generate` | `Clip Library`

**ClipLibraryPanel** (left + right layout):

Left panel:
- Per-category progress bars (N/total ready) with color-coded status
- "Build Missing Clips" button (triggers POST /build)
- "Retry Errors" button
- Live poll every 5s while build is running

Right panel:
- Grid of clip thumbnails (4 per row)
- Each card: thumbnail image, label, category badge, status dot
- Click ready clip → inline `<video>` preview
- "Add Custom Clip" button → modal (custom prompt + category + tags)

---

## Files To Create / Modify

### New
- `lib/stability/clip-library.ts` — `SEED_CLIPS` constant, `buildClipLibrary()`, `extractThumbnail()`
- `lib/stability/clip-selector.ts` — `selectClipForScene()`, `getRecentClipIds()`, `copyClipToBgPath()`
- `app/api/stability/clips/route.ts` — GET list, POST build trigger
- `app/api/stability/clips/[id]/video/route.ts` — stream .mp4
- `app/api/stability/clips/[id]/thumb/route.ts` — serve .jpg
- `components/ClipLibraryPanel.tsx` — library UI

### Modified
- `lib/db.ts` — add `anatomy_clips` table, `AnatomyClipRow`, `anatomyClips` helper
- `lib/stability/types.ts` — add `bg_category`, `bg_tags`, `bg_clip_id` to `StabilityScene`; add `AnatomyCategory`
- `app/api/stability/generate/route.ts` — update Claude prompt + swap Higgsfield calls for clip selector
- `components/MascotSection.tsx` — add `Generate | Clip Library` tab bar, render `ClipLibraryPanel`

---

## Speed Impact

| Step | Before | After |
|---|---|---|
| Higgsfield × 5 (parallel) | ~5 min | 0 (file copy ~50ms) |
| ElevenLabs TTS × 5 | ~10s | ~10s |
| Rock PNG render × 5 | ~1s | ~1s |
| Compositing + concat | ~35s | ~35s |
| **Total** | **~5–6 min** | **~45 sec** |

## Verification

1. **Build the library**: Hit "Build Missing Clips" — watch category bars fill in. Verify `.mp4` files appear in `outputs/anatomy-clips/`
2. **Preview clips**: Click each ready clip in the grid — confirm it plays correctly, looks high-quality
3. **Generate a video**: With library ready, generate a video and confirm it finishes in ~45s (not 5 min)
4. **Check variety**: Generate 3 videos on the same topic — confirm each uses different background clips (check `bg_clip_id` in stored script JSON)
5. **Fallback test**: Temporarily set all clips to `status='error'` in DB — confirm generation still works via live Higgsfield
6. **Recency test**: Generate 5 videos on the same topic — confirm recently-used clips are deprioritized in clip selection
