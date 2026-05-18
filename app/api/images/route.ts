import { NextRequest, NextResponse } from 'next/server';
import { fetchAndCropImage, searchImages } from '@/lib/images';
import path from 'path';
import fs from 'fs';

// GET /api/images?query=...&index=0
// Returns the local file path (or base64 data URL) of a cropped 1080x1920 image
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  const index = parseInt(searchParams.get('index') ?? '0', 10);
  const mode = searchParams.get('mode') ?? 'file'; // 'file' | 'search'

  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

  try {
    if (mode === 'search') {
      const count = parseInt(searchParams.get('count') ?? '6', 10);
      const photos = await searchImages(query, count);
      return NextResponse.json({ photos });
    }

    const filePath = await fetchAndCropImage(query, index);
    const relativePath = path.relative(process.cwd(), filePath);

    // Return base64 data URL so the browser can render it directly
    const buffer = fs.readFileSync(filePath);
    const b64 = buffer.toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;

    return NextResponse.json({ path: relativePath, dataUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
