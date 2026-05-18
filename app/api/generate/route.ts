import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const OVERLAY_STYLES: Record<string, string> = {
  'Dark Cinematic': 'dark-cinematic',
  'Moody Warm':     'moody-warm',
  'Grain Noir':     'grain-noir',
  'Winter Arc':     'winter-arc',
  'Dark Academia':  'dark-academia',
  'Organic Raw':    'organic-raw',
};

export async function POST(req: NextRequest) {
  try {
    const { topic, niche, tone, template, slide_count = 5 } = await req.json();

    if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });

    const overlayStyle = OVERLAY_STYLES[template] ?? 'dark-cinematic';

    const isOrganic = template === 'Organic Raw';

    const prompt = `You are a viral TikTok content strategist. Create a ${slide_count}-slide photo slideshow for TikTok about: "${topic}"
${niche ? `Niche: ${niche}` : ''}
${tone ? `Tone: ${tone}` : ''}
Template: ${template ?? 'Dark Cinematic'}

Return ONLY valid JSON with this exact structure:
{
  "title": "Short post title (max 8 words)",
  "caption": "TikTok caption (max 150 chars, engaging, includes a hook)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "slides": [
    {
      "headline": "SLIDE HEADLINE (slide 1 MUST be the hook/title that stops the scroll)",
      "body": "Optional supporting text (1-2 sentences). null if not needed.",
      "image_search": "Short 2-4 word Pinterest search (e.g. 'morning routine aesthetic', 'gym lifestyle', 'NYC hustle')",
      "overlay_style": "${overlayStyle}",
      "animation_hint": "fade-up | zoom-in | slide-left | slide-right | fade"
    }
  ]
}

CRITICAL: Slide 1 is ALWAYS the hook/title slide — the single most compelling line that makes someone stop scrolling. It sets the premise for everything that follows.
CRITICAL: Slide 1's image_search MUST always be exactly "faceless ugc selfie" — no exceptions.

${isOrganic ? `ORGANIC RAW rules — follow these exactly:
- Headlines use lowercase only, never ALL CAPS. Slide 1 is always the hook — no number prefix. For slides 2 onward, prefix each tip/point with its sequential tip number starting from 1 (e.g. slide 2 gets "1. i stopped doing x", slide 3 gets "2. i learned y"). Short, punchy, reads like a real person talking. Max 10 words.
- Body text is conversational — 1-2 short sentences, sounds like a phone caption. No buzzwords. Keep each sentence on its own line (use \n between sentences).
- image_search: 2-4 word Pinterest aesthetic term — short, vibe-based. Examples: "morning stretch aesthetic", "gym iphone photo", "couch lifestyle candid", "running outdoor aesthetic", "home workout natural light". NO long sentences, NO stock-photo language.` : `Rules:
- Headlines should be short, punchy, ALL CAPS style (Bebas Neue font)
- Each slide should build tension or curiosity
- image_search: 2-4 word Pinterest aesthetic term. Examples: "dark city aesthetic", "wolf of wall street", "luxury lifestyle iphone", "NYC hustle aesthetic", "cinematic sunset". Short and vibe-based, not descriptive sentences.
- The last slide should have a strong CTA or resolution
- Make it feel emotional, aspirational, or shocking — viral energy`}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude did not return valid JSON');

    const slideshow = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ slideshow, overlay_style: overlayStyle });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
