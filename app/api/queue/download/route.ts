import { NextResponse } from 'next/server';
import { listQueue, updateQueueItem } from '@/lib/queue';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DOWNLOAD_DIR = path.join(process.env.HOME ?? '/Users/griffinhunt', 'Desktop', 'Slideshows');

export async function POST() {
  try {
    const items = listQueue().filter(i => i.status === 'pending' || i.status === 'failed');

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items in queue to download.' }, { status: 400 });
    }

    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

    const downloaded: string[] = [];
    const errors: string[] = [];

    for (const item of items) {
      const slides = item.slide_paths.filter(p => fs.existsSync(p)).sort();
      if (slides.length === 0) {
        errors.push(`"${item.title}": slide files not found`);
        continue;
      }

      // Folder name = sanitised title
      const slug = item.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-');
      const dest = path.join(DOWNLOAD_DIR, slug);
      fs.mkdirSync(dest, { recursive: true });

      // Write caption.txt
      if (item.caption) {
        fs.writeFileSync(path.join(dest, 'caption.txt'), item.caption, 'utf8');
      }

      // Copy slides
      for (const src of slides) {
        fs.copyFileSync(src, path.join(dest, path.basename(src)));
      }

      downloaded.push(slug);
      updateQueueItem(item.id, { status: 'posted', posted_at: new Date().toISOString() });
    }

    // Open the ReelFarm folder in Finder
    await execAsync(`open "${DOWNLOAD_DIR}"`);

    return NextResponse.json({ ok: true, downloaded, errors, path: DOWNLOAD_DIR });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
