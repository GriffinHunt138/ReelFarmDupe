import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  const body = await req.json() as { topic?: string; slideCount?: number };
  const topic      = body.topic?.trim();
  const slideCount = Math.max(2, Math.min(10, body.slideCount ?? 5));

  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are creating presentation slides for Rocky the Stability Rock — a TikTok mascot who explains back pain, posture, and spine health. Slides are dark navy, text-forward, punchy.

TOPIC: "${topic}"
SLIDE COUNT: ${slideCount}

SLIDE 1 — VIRAL HOOK (non-negotiable): Must make someone stop scrolling mid-thumb.
Use a pattern-disrupting formula:
- Counterintuitive truth: "Rest is destroying your back" / "Strong abs don't fix pain"
- Shocking call-out: "You've been sitting wrong for years" / "This is why you never heal"
- Bold claim that creates urgency: "Your doctor won't tell you this" / "Stop doing this now"
Headline: 4-7 words, feels like a punch to the face. No chip. No accent.

SLIDES 2 to ${slideCount - 1}: Explanation, mechanism, step-by-step tips or causes.
SLIDE ${slideCount} — Hard CTA: Exactly what to do, right now.

Each slide has exactly 2 fields:
- "headline": 3-7 words. Punchy fragment or bold claim. NOT a full sentence.
- "body": 1 sentence of supporting context. Can be "" for pure impact slides.

No chip labels. No accent stats. Headline + body only.

Return ONLY a JSON array of exactly ${slideCount} slides:
[
  { "headline": "Rest is wrecking your back", "body": "Lying still tightens the exact muscles causing your pain — movement is the medicine." },
  { "headline": "Your hips are the problem", "body": "Tight hip flexors yank your pelvis forward and crush your lumbar discs all day long." }
]

CRITICAL: Return ONLY the raw JSON array. No markdown fences, no explanation.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw   = message.content[0].type === 'text' ? message.content[0].text : '';
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Claude did not return a JSON array');

    const slides = JSON.parse(match[0]) as Array<{
      headline: string; body?: string;
    }>;

    return NextResponse.json({ slides });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
