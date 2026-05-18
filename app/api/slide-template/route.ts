import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Serves the raw slide.html template so the client can build iframe previews
// using the identical HTML/CSS that Playwright uses to render PNGs.
export async function GET() {
  const templatePath = path.join(process.cwd(), 'templates', 'slide.html');
  const html = fs.readFileSync(templatePath, 'utf-8');
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
