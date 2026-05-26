import fs from 'fs';
import path from 'path';
import axios from 'axios';

const BASE = 'https://api.elevenlabs.io/v1';

// Default: "Adam" — authoritative, calm. Override via ELEVENLABS_VOICE_ID env var.
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

export async function textToSpeech(text: string, outputPath: string): Promise<void> {
  const apiKey   = process.env.ELEVENLABS_API_KEY;
  const voiceId  = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  const res = await axios.post(
    `${BASE}/text-to-speech/${voiceId}`,
    {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
    },
    {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      responseType: 'arraybuffer',
      timeout: 60_000,
    }
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(res.data));
}

/** Returns the duration in seconds of an mp3 file using ffprobe. */
export async function getAudioDuration(mp3Path: string): Promise<number> {
  const { execSync } = await import('child_process');
  const FFPROBE = process.env.FFPROBE_PATH ?? '/opt/homebrew/bin/ffprobe';
  try {
    const out = execSync(
      `${FFPROBE} -v quiet -show_entries format=duration -of csv=p=0 "${mp3Path}"`,
      { encoding: 'utf8' }
    );
    return parseFloat(out.trim()) || 10;
  } catch {
    return 10;
  }
}
