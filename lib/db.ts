import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'reelfarm.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
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
      post_times    TEXT NOT NULL DEFAULT '["09:00","11:00","13:00","15:00","17:00","19:00"]'
    );

    INSERT OR IGNORE INTO queue_settings (id, posts_per_day, post_times)
    VALUES (1, 6, '["09:00","11:00","13:00","15:00","17:00","19:00"]');

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
