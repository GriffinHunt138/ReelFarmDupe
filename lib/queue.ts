import { getDb } from './db';

export interface QueueSettings {
  posts_per_day: number;
  post_times: string[]; // HH:MM strings, e.g. ["09:00","11:00"]
  notify_phone: string; // phone number for iMessage delivery
}

export interface QueueItem {
  id: number;
  slideshow_id: string | null;
  title: string;
  caption: string | null;
  hashtags: string | null;       // JSON array string
  output_dir: string;
  slide_paths: string[];         // parsed from JSON
  scheduled_at: string;          // ISO
  status: 'pending' | 'posting' | 'posted' | 'failed';
  error_msg: string | null;
  posted_at: string | null;
  created_at: string;
}

// ── Settings ───────────────────────────────────────────────────────────────
export function getSettings(): QueueSettings {
  const row = getDb().prepare('SELECT * FROM queue_settings WHERE id = 1').get() as {
    posts_per_day: number; post_times: string; notify_phone: string;
  };
  return {
    posts_per_day: row.posts_per_day,
    post_times: JSON.parse(row.post_times),
    notify_phone: row.notify_phone ?? '+12035363028',
  };
}

export function saveSettings(s: QueueSettings): void {
  getDb()
    .prepare('UPDATE queue_settings SET posts_per_day = ?, post_times = ?, notify_phone = ? WHERE id = 1')
    .run(s.posts_per_day, JSON.stringify(s.post_times), s.notify_phone);
}

// ── Slot calculation ───────────────────────────────────────────────────────
export function getNextSlot(): Date {
  const { posts_per_day, post_times } = getSettings();

  // Always iterate times in chronological order
  const sortedTimes = [...post_times].sort();

  // All currently scheduled slots (pending or posting)
  const takenRows = (getDb().prepare(
    `SELECT scheduled_at FROM post_queue WHERE status IN ('pending','posting') ORDER BY scheduled_at`
  ).all() as { scheduled_at: string }[]);

  const takenMs = takenRows.map(r => new Date(r.scheduled_at).getTime());

  // Count taken slots per calendar day (YYYY-MM-DD)
  const countPerDay: Record<string, number> = {};
  for (const r of takenRows) {
    const day = r.scheduled_at.slice(0, 10);
    countPerDay[day] = (countPerDay[day] ?? 0) + 1;
  }

  const now = new Date();
  // Require slots to be at least 2 minutes from now so we don't schedule in the past
  const minTime = new Date(now.getTime() + 2 * 60 * 1000);

  for (let day = 0; day < 60; day++) {
    // Build the calendar date string for this day
    const d = new Date(now);
    d.setDate(d.getDate() + day);
    const dateKey = d.toISOString().slice(0, 10);

    // Skip this day if already at the posts_per_day cap
    if ((countPerDay[dateKey] ?? 0) >= posts_per_day) continue;

    for (const t of sortedTimes) {
      const [h, m] = t.split(':').map(Number);
      const slot = new Date(d);
      slot.setHours(h, m, 0, 0);

      // Must be in the future
      if (slot <= minTime) continue;

      // Must not collide with an existing slot (within 30 min)
      if (takenMs.some(ts => Math.abs(ts - slot.getTime()) < 30 * 60 * 1000)) continue;

      return slot;
    }
  }
  throw new Error('No available slots in the next 60 days');
}

// ── CRUD ───────────────────────────────────────────────────────────────────
function parseRow(r: Record<string, unknown>): QueueItem {
  return { ...r, slide_paths: JSON.parse(r.slide_paths as string) } as QueueItem;
}

export function addToQueue(data: {
  slideshow_id?: string;
  title: string;
  caption?: string;
  hashtags?: string[];
  output_dir: string;
  slide_paths: string[];
}): QueueItem {
  const slot = getNextSlot();
  const db = getDb();
  const res = db.prepare(`
    INSERT INTO post_queue (slideshow_id, title, caption, hashtags, output_dir, slide_paths, scheduled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.slideshow_id ?? null,
    data.title,
    data.caption ?? null,
    data.hashtags ? JSON.stringify(data.hashtags) : null,
    data.output_dir,
    JSON.stringify(data.slide_paths),
    slot.toISOString(),
  );
  return getQueueItem(res.lastInsertRowid as number)!;
}

export function getQueueItem(id: number): QueueItem | null {
  const r = getDb().prepare('SELECT * FROM post_queue WHERE id = ?').get(id) as Record<string, unknown> | null;
  return r ? parseRow(r) : null;
}

export function listQueue(): QueueItem[] {
  return (getDb().prepare('SELECT * FROM post_queue ORDER BY scheduled_at ASC').all() as Record<string, unknown>[])
    .map(parseRow);
}

export function updateQueueItem(id: number, u: Partial<Pick<QueueItem, 'status' | 'error_msg' | 'posted_at' | 'scheduled_at'>>): void {
  const sets = Object.keys(u).map(k => `${k} = ?`).join(', ');
  getDb().prepare(`UPDATE post_queue SET ${sets} WHERE id = ?`).run(...Object.values(u), id);
}

export function removeFromQueue(id: number): void {
  getDb().prepare('DELETE FROM post_queue WHERE id = ?').run(id);
}

export function getDueItems(): QueueItem[] {
  const now = new Date().toISOString();
  return (getDb().prepare(
    `SELECT * FROM post_queue WHERE status = 'pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC`
  ).all(now) as Record<string, unknown>[]).map(parseRow);
}
