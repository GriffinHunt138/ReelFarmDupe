import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'faceless.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  // Add notify_phone to existing DBs that were created before this column existed
  try {
    db.exec(`ALTER TABLE queue_settings ADD COLUMN notify_phone TEXT NOT NULL DEFAULT '+12035363028'`);
  } catch { /* column already exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS post_queue (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slideshow_id  TEXT,
      title         TEXT NOT NULL,
      caption       TEXT,
      hashtags      TEXT,
      output_dir    TEXT NOT NULL,
      slide_paths   TEXT NOT NULL,
      scheduled_at  TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      error_msg     TEXT,
      posted_at     TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS queue_settings (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      posts_per_day INTEGER NOT NULL DEFAULT 6,
      post_times    TEXT NOT NULL DEFAULT '["09:00","11:00","13:00","15:00","17:00","19:00"]',
      notify_phone  TEXT NOT NULL DEFAULT '+12035363028'
    );

    INSERT OR IGNORE INTO queue_settings (id, posts_per_day, post_times, notify_phone)
    VALUES (1, 6, '["09:00","11:00","13:00","15:00","17:00","19:00"]', '+12035363028');

    CREATE TABLE IF NOT EXISTS posts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      niche       TEXT,
      tone        TEXT,
      template    TEXT,
      slide_count INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      output_path TEXT,
      tiktok_post_id TEXT,
      caption     TEXT,
      hashtags    TEXT,
      slides_json TEXT
    );

    CREATE TABLE IF NOT EXISTS stability_jobs (
      id          TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'pending',
      step        TEXT,
      progress    INTEGER NOT NULL DEFAULT 0,
      topic       TEXT NOT NULL,
      error       TEXT,
      video_path  TEXT,
      script      TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tiktok_auth (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      open_id       TEXT NOT NULL,
      username      TEXT,
      avatar_url    TEXT,
      expires_at    TEXT,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS anatomy_clips (
      id                TEXT PRIMARY KEY,
      category          TEXT NOT NULL,
      tags              TEXT NOT NULL,
      label             TEXT NOT NULL,
      prompt            TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pending',
      higgsfield_job_id TEXT,
      video_path        TEXT,
      thumb_path        TEXT,
      duration          REAL,
      error             TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export interface Post {
  id: number;
  title: string;
  niche: string | null;
  tone: string | null;
  template: string | null;
  slide_count: number;
  created_at: string;
  output_path: string | null;
  tiktok_post_id: string | null;
  caption: string | null;
  hashtags: string | null;
  slides_json: string | null;
}

export interface TikTokAuth {
  id: number;
  access_token: string;
  refresh_token: string | null;
  open_id: string;
  username: string | null;
  avatar_url: string | null;
  expires_at: string | null;
  updated_at: string;
}

export interface StabilityJobRow {
  id: string;
  status: string;
  step: string | null;
  progress: number;
  topic: string;
  error: string | null;
  video_path: string | null;
  script: string | null;
  created_at: string;
}

export const stabilityJobs = {
  create(id: string, topic: string): void {
    getDb().prepare(
      `INSERT INTO stability_jobs (id, topic, status, progress) VALUES (?, ?, 'pending', 0)`
    ).run(id, topic);
  },

  update(id: string, data: Partial<Omit<StabilityJobRow, 'id' | 'created_at'>>): void {
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    getDb().prepare(`UPDATE stability_jobs SET ${fields} WHERE id = @id`).run({ ...data, id });
  },

  get(id: string): StabilityJobRow | null {
    return getDb().prepare('SELECT * FROM stability_jobs WHERE id = ?').get(id) as StabilityJobRow | null;
  },

  list(): StabilityJobRow[] {
    return getDb().prepare('SELECT * FROM stability_jobs ORDER BY created_at DESC LIMIT 50').all() as StabilityJobRow[];
  },
};

export interface AnatomyClipRow {
  id: string;
  category: string;
  tags: string;         // JSON array string
  label: string;
  prompt: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  higgsfield_job_id: string | null;
  video_path: string | null;
  thumb_path: string | null;
  duration: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export const anatomyClips = {
  upsert(clip: Omit<AnatomyClipRow, 'created_at' | 'updated_at'>): void {
    getDb().prepare(`
      INSERT OR REPLACE INTO anatomy_clips
        (id, category, tags, label, prompt, status, higgsfield_job_id, video_path, thumb_path, duration, error)
      VALUES
        (@id, @category, @tags, @label, @prompt, @status, @higgsfield_job_id, @video_path, @thumb_path, @duration, @error)
    `).run(clip);
  },

  update(id: string, data: Partial<Omit<AnatomyClipRow, 'id' | 'created_at'>>): void {
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    const withTimestamp = { ...data, updated_at: new Date().toISOString(), id };
    getDb().prepare(
      `UPDATE anatomy_clips SET ${fields}, updated_at = @updated_at WHERE id = @id`
    ).run(withTimestamp);
  },

  get(id: string): AnatomyClipRow | null {
    return getDb().prepare('SELECT * FROM anatomy_clips WHERE id = ?').get(id) as AnatomyClipRow | null;
  },

  list(): AnatomyClipRow[] {
    return getDb().prepare('SELECT * FROM anatomy_clips ORDER BY category, id').all() as AnatomyClipRow[];
  },

  listByCategory(category: string): AnatomyClipRow[] {
    return getDb().prepare(
      'SELECT * FROM anatomy_clips WHERE category = ? ORDER BY id'
    ).all(category) as AnatomyClipRow[];
  },

  listReady(): AnatomyClipRow[] {
    return getDb().prepare(
      "SELECT * FROM anatomy_clips WHERE status = 'ready' ORDER BY category, id"
    ).all() as AnatomyClipRow[];
  },
};

export const db = {
  createPost(data: Omit<Post, 'id' | 'created_at'>): Post {
    const stmt = getDb().prepare(`
      INSERT INTO posts (title, niche, tone, template, slide_count, output_path, tiktok_post_id, caption, hashtags, slides_json)
      VALUES (@title, @niche, @tone, @template, @slide_count, @output_path, @tiktok_post_id, @caption, @hashtags, @slides_json)
    `);
    const result = stmt.run(data);
    return getDb().prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid) as Post;
  },

  updatePost(id: number, data: Partial<Post>): void {
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    getDb().prepare(`UPDATE posts SET ${fields} WHERE id = @id`).run({ ...data, id });
  },

  getPost(id: number): Post | null {
    return getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | null;
  },

  listPosts(): Post[] {
    return getDb().prepare('SELECT * FROM posts ORDER BY created_at DESC').all() as Post[];
  },

  saveTikTokAuth(data: Omit<TikTokAuth, 'id' | 'updated_at'>): void {
    const existing = getDb().prepare('SELECT id FROM tiktok_auth LIMIT 1').get() as { id: number } | null;
    if (existing) {
      getDb().prepare(`
        UPDATE tiktok_auth SET access_token=@access_token, refresh_token=@refresh_token,
        open_id=@open_id, username=@username, avatar_url=@avatar_url, expires_at=@expires_at,
        updated_at=datetime('now') WHERE id=@id
      `).run({ ...data, id: existing.id });
    } else {
      getDb().prepare(`
        INSERT INTO tiktok_auth (access_token, refresh_token, open_id, username, avatar_url, expires_at)
        VALUES (@access_token, @refresh_token, @open_id, @username, @avatar_url, @expires_at)
      `).run(data);
    }
  },

  getTikTokAuth(): TikTokAuth | null {
    return getDb().prepare('SELECT * FROM tiktok_auth LIMIT 1').get() as TikTokAuth | null;
  },

  deleteTikTokAuth(): void {
    getDb().prepare('DELETE FROM tiktok_auth').run();
  },
};
