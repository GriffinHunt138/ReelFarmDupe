import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  try {
    const { niche, tone, subject, audience, count = 10 } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const focus = subject?.trim()
      ? `specifically about "${subject.trim()}"${niche ? ` in the "${niche}" niche` : ''}`
      : `for the "${niche || 'lifestyle'}" niche`;

    const prompt = `Generate ${count} viral TikTok slideshow hooks/topics ${focus}${tone ? ` with a "${tone}" tone` : ''}${audience ? ` targeting "${audience}"` : ''}.

Rules:
- Short and punchy — max 8 words each
- No emojis, no punctuation flourishes
- Mix question hooks, list hooks, and story hooks
- Sound like something a real person would say
${audience ? `- Write from the perspective of or addressing a "${audience}"` : ''}

Good examples: "5 habits that fixed my back pain", "can back pain go away on its own", "i stopped doing this and my back healed", "why your back hurts every morning"

Return ONLY a valid JSON array of ${count} strings, no other text, no numbering:
["hook 1", "hook 2", ...]`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Failed to parse topics from Claude response');

    const topics: string[] = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ topics });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
