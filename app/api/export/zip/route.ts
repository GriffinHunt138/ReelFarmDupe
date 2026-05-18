import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';

// Minimal ZIP builder using Node built-ins (no external deps)
function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const centralDir: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes  = Buffer.from(file.name, 'utf8');
    const compressed = zlib.deflateRawSync(file.data, { level: 6 });
    const crc        = crc32(file.data);

    // Local file header
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);   // signature
    local.writeUInt16LE(20, 4);            // version needed
    local.writeUInt16LE(0, 6);             // flags
    local.writeUInt16LE(8, 8);             // compression: deflate
    local.writeUInt16LE(0, 10);            // mod time
    local.writeUInt16LE(0, 12);            // mod date
    local.writeUInt32LE(crc >>> 0, 14);    // crc-32
    local.writeUInt32LE(compressed.length, 18); // compressed size
    local.writeUInt32LE(file.data.length, 22);  // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26);  // filename length
    local.writeUInt16LE(0, 28);                 // extra length
    nameBytes.copy(local, 30);

    parts.push(local, compressed);

    // Central directory entry
    const cent = Buffer.alloc(46 + nameBytes.length);
    cent.writeUInt32LE(0x02014b50, 0);
    cent.writeUInt16LE(20, 4);
    cent.writeUInt16LE(20, 6);
    cent.writeUInt16LE(0, 8);
    cent.writeUInt16LE(8, 10);
    cent.writeUInt16LE(0, 12);
    cent.writeUInt16LE(0, 14);
    cent.writeUInt32LE(crc >>> 0, 16);
    cent.writeUInt32LE(compressed.length, 20);
    cent.writeUInt32LE(file.data.length, 24);
    cent.writeUInt16LE(nameBytes.length, 28);
    cent.writeUInt16LE(0, 30);
    cent.writeUInt16LE(0, 32);
    cent.writeUInt16LE(0, 34);
    cent.writeUInt16LE(0, 36);
    cent.writeUInt32LE(0, 38);
    cent.writeUInt32LE(offset, 42);
    nameBytes.copy(cent, 46);
    centralDir.push(cent);

    offset += local.length + compressed.length;
  }

  const cdBuf    = Buffer.concat(centralDir);
  const eocd     = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, cdBuf, eocd]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function POST(req: NextRequest) {
  try {
    const { slidePaths, title } = await req.json();
    if (!slidePaths?.length) return NextResponse.json({ error: 'slidePaths required' }, { status: 400 });

    const files = (slidePaths as string[])
      .map((rel: string) => {
        const abs = path.resolve(process.cwd(), rel);
        if (!fs.existsSync(abs)) return null;
        return { name: path.basename(abs), data: fs.readFileSync(abs) };
      })
      .filter(Boolean) as { name: string; data: Buffer }[];

    if (!files.length) return NextResponse.json({ error: 'No files found' }, { status: 400 });

    const zip = buildZip(files);

    const slideshowsDir = path.join(os.homedir(), 'Desktop', 'slideshows');
    fs.mkdirSync(slideshowsDir, { recursive: true });

    const safeName = (title ?? 'slideshow')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const zipName = `${safeName}-${Date.now().toString(36)}.zip`;
    const zipPath = path.join(slideshowsDir, zipName);

    fs.writeFileSync(zipPath, zip);

    return NextResponse.json({ zipPath, zipName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
