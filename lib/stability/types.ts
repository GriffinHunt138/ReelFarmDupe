import type { RockMood } from '@/components/StabilityRock';

export type { RockMood };

export type AnatomyCategory =
  | 'vertebral'
  | 'muscle'
  | 'nerve'
  | 'ligament'
  | 'posture'
  | 'movement'
  | 'circulation';

export interface StabilityScene {
  text: string;           // narration text → ElevenLabs TTS
  duration: number;       // target seconds (audio drives actual duration)
  mood: RockMood;         // rock character expression
  // Slide content — what appears on screen as Rocky talks
  slide_chip?: string;
  slide_headline: string;
  slide_body?: string;
  slide_accent?: string;
  // Position overrides from editor (0-100 % of canvas). Required for WYSIWYG.
  slide_chipPos?:     { x: number; y: number };
  slide_headlinePos?: { x: number; y: number };
  slide_bodyPos?:     { x: number; y: number };
  slide_accentPos?:   { x: number; y: number };
  slide_rockyPos?:    { x: number; y: number };
  // Font / size / width overrides
  slide_hlFont?:       string;
  slide_hlFontSize?:   number;
  slide_hlWidth?:      number;
  slide_bodyFont?:     string;
  slide_bodyFontSize?: number;
  slide_bodyWidth?:    number;
  // Optional overlay image (base64 data URL)
  slide_imageDataUrl?: string;
  slide_imageX?: number;  // center % of canvas width
  slide_imageY?: number;  // center % of canvas height
  slide_imageW?: number;  // width % of canvas width
  slide_imageH?: number;  // height % of canvas height
}

export interface StabilityScript {
  title: string;
  hashtags: string[];
  scenes: StabilityScene[];
}

export interface StabilityJob {
  id: string;
  status: 'pending' | 'scripting' | 'audio' | 'video' | 'compositing' | 'done' | 'error';
  step: string | null;
  progress: number;
  topic: string;
  error: string | null;
  video_path: string | null;
  script: string | null;
  created_at: string;
}
