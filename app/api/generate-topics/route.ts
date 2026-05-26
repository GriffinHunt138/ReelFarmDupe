import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  try {
    const { niche, tone, subject, audience, template, listStyle, count = 10 } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const isEvidence = template === 'Evidence Based';
    const isVirality = template === 'Virality Optimized';

    const focus = subject?.trim()
      ? `specifically about "${subject.trim()}"${niche ? ` in the "${niche}" niche` : ''}`
      : `for the "${niche || 'lifestyle'}" niche`;

    const listRule = listStyle
      ? `CRITICAL: Every single topic MUST start with a number (2–7) followed by a noun — e.g. "3 bad habits...", "5 things research says...", "4 stretches that...", "6 signs your...", "3 reasons why...". No exceptions — all ${count} topics must be list-format.`
      : '';

    const prompt = isVirality
      ? `Generate ${count} TikTok slideshow hooks ${focus}${audience ? ` targeting "${audience}"` : ''}.

These are hooks for a back pain content channel. Each hook must make someone with back pain immediately think "yes, that's exactly me" — zero interpretation required. They describe a real, specific experience someone with back pain actually lives with.

The test for every hook: would someone with back pain read this and instantly recognize their own life? If they have to think about what it means, it fails.

Rules:
- 5–9 words. Direct and punchy.
- All lowercase. No emojis.
- Must name "back", "back pain", or "lower back" explicitly.
- Describe a real lived experience — not an abstract concept or metaphor.
- Conversational — sounds like something a real person would say.
- Creates curiosity or mild tension without being cryptic.
${listRule}

GOOD examples (instantly relatable, describe real experiences):
"why your back hurts more after resting"
"my back went out doing almost nothing"
"i stretch every day and it still hurts"
"why your lower back never fully loosens up"
"your back pain is worse on work days"
"i fixed my back pain and it came back"
"your lower back locks up when you stand too long"
"why your back feels fine then suddenly doesn't"
"your back hurts more sitting than moving"
"why your back pain moves around"
"your lower back tightens at the same time every day"
"why your back is stiff every single morning"

BAD examples (cryptic, abstract, weird — never generate these):
"your back pain starts somewhere else entirely"
"your back is reacting to what you sit on"
"your lower back is covering for something it shouldn't"
"your back gave up asking nicely"
"you fixed your back but never fixed this"
"something upstream is pulling the strings"
"your body found a workaround"
"it's not weakness it's avoidance"

Return ONLY a valid JSON array of ${count} strings, no other text, no numbering:
["hook 1", "hook 2", ...]`
      : isEvidence
      ? `Generate ${count} TikTok slideshow topics ${focus}${audience ? ` targeting "${audience}"` : ''}.

These are for an Evidence Based / educational preset — the content explains mechanisms, references research, and shares specific facts. NOT motivational or preachy.

Rules:
- Max 8 words each
- No emojis, no punctuation flourishes
- Frame as curiosity gaps, surprising facts, or "here's what actually happens" angles
- Sound like a knowledgeable friend sharing something they just learned, not a coach
- Mix: "what actually causes X", "the science behind X", "why X happens", "what research says about X", numbered lists of specific facts
- NO "you should", "stop doing", "transform your" — just informational hooks
${listRule}

Good examples: "the actual reason your lower back hurts", "what happens to your spine sitting all day", "why most back pain isn't a muscle problem", "3 things research says about back pain recovery", "5 muscles that cause lower back pain"

Return ONLY a valid JSON array of ${count} strings, no other text, no numbering:
["hook 1", "hook 2", ...]`
      : `Generate ${count} viral TikTok slideshow hooks/topics ${focus}${tone ? ` with a "${tone}" tone` : ''}${audience ? ` targeting "${audience}"` : ''}.

Rules:
- Short and punchy — max 8 words each
- No emojis, no punctuation flourishes
- Mix question hooks, list hooks, and story hooks
- Sound like something a real person would say
${audience ? `- Write from the perspective of or addressing a "${audience}"` : ''}
${listRule}

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
