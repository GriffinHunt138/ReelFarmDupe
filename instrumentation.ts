import fs from 'fs';
import path from 'path';

export async function register() {
  // Load .env.local manually (needed in some Next.js configs)
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) process.env[key] = value;
    }
  }

  // Start the background queue worker (Node.js runtime only)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startQueueWorker } = await import('./lib/queue-worker');
    startQueueWorker();
  }
}
