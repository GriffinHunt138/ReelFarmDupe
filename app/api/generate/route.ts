import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const OVERLAY_STYLES: Record<string, string> = {
  'Dark Cinematic':     'dark-cinematic',
  'Organic Raw':        'organic-raw',
  'Evidence Based':     'organic-raw',
  'Virality Optimized': 'organic-raw',
};

export async function POST(req: NextRequest) {
  try {
    const { topic, niche, tone, template, slide_count: _slide_count = 5, audience } = await req.json();
    const slide_count = template === 'Virality Optimized' ? 7 : _slide_count;

    if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });

    const overlayStyle = OVERLAY_STYLES[template] ?? 'dark-cinematic';

    const isOrganic   = template === 'Organic Raw';
    const isEvidence  = template === 'Evidence Based';
    const isVirality  = template === 'Virality Optimized';

    const VIRALITY_SYSTEM = `You are an elite TikTok / Instagram Reels growth strategist creating slideshow content for health, fitness, pain, and self-improvement audiences.

Your job is to create slideshows that feel:
- emotionally immediate
- observational
- psychologically accurate
- slightly raw
- deeply human
- conversational
- native to TikTok slideshow culture

The content should feel less like "a wellness carousel" and more like "someone finally explaining the exact thing I've been experiencing."

STOP writing like: a teacher, a PT clinic, a startup, a wellness brand, an educational infographic.
START writing like: someone making an emotionally accurate observation, someone exposing hidden patterns, someone realizing something important, someone documenting a frustrating experience, someone finally connecting the dots.

The viewer should feel: understood, exposed, validated, curious, emotionally recognized.
The content should trigger: "holy shit this is exactly what happens to me."

====================================
WRITING STYLE
====================================

The writing should feel MORE conversational and LESS complete. Do NOT overexplain. Do NOT fully resolve every idea. Do NOT sound polished. Do NOT sound medically educational.

Instead: imply things on slides 1–3 to build tension. Then deliver real, specific insight on slides 4–5. Slides 6–7 zoom out emotionally. The arc is: hook → recognition → REAL INSIGHT → pattern → resolution.

GOOD copy (slide 1 always names the back; slides 2+ can be more general once context is set):
- "your back pain isn't coming from your back." (slide 1)
- "your back's been compensating for years." (slide 1)
- "your lower back is reacting to your habits." (slide 1)
- "my back pain made way more sense once I tracked it." (slide 1)
- "your back is taking the hit." (slide 2+)
- "stretching never fixed the actual problem." (slide 2+)
- "I felt fine until suddenly I didn't." (slide 2+)
- "the pattern had been there the whole time." (slide 2+)
- "your body adapts to whatever you repeatedly do." (slide 2+)
- "I thought it was random." (slide 2+)

BAD copy (never write like this):
- "tight hips and weak glutes cause compensation."
- "this muscle is overactive."
- "here are 5 exercises."
- "improve your posture."
- "research shows."
- "your back pain originates from muscular imbalances."

====================================
TEXT LENGTH
====================================

Most slides: 3–12 words maximum. One emotionally strong idea. One realization. One tension point. Whitespace is good. Minimal copy often performs best.

Examples:
- "your pain isn't random."
- "your back is compensating."
- "you keep treating the symptom."
- "your body adapted."
- "you probably missed the pattern."
- "your body's reacting to your routine."
- "your pain has triggers."
- "your back's been overworking for years."

====================================
7-SLIDE STRUCTURE (always exactly 7 slides)
====================================

Every slideshow is exactly 7 slides. The arc: emotional hook → value promise → real teaching content (x2) → common mistakes → correction → small win. Written conversationally — never clinical, never educational-sounding. The viewer should finish feeling like they learned something real from a person, not a brand.

SLIDE 1 — HOOK
Emotional or curiosity-driven contrast. Names "back" or "back pain" explicitly. Must create immediate tension — viewer thinks "I need to know where this is going." Tie it to a real lived experience or counterintuitive idea. 4–10 words.
Examples: "you've been stretching the wrong thing." / "your back pain isn't coming from your back." / "the real reason your lower back keeps flaring up." / "why your back hurts more after resting."

SLIDE 2 — VALUE PROMISE (what they'll learn)
Tells the viewer what this slideshow will give them and why it matters. One clear, emotionally resonant promise — not a list. Should feel like: "if you keep reading, you'll finally understand X." Creates a reason to keep swiping. 8–16 words.
Examples: "I'm going to show you exactly why it keeps coming back — and it's not what you think." / "by the end of this you'll understand the actual pattern behind your flare-ups." / "this changed how I think about my back pain completely."

SLIDE 3 — TEACHING CONTENT PT. 1
First real insight. Specific — names what is actually happening, not vague emotional language. Teach or demonstrate the first point of the core idea clearly. Conversational but substantive. 8–18 words.
Examples: "your hips stopped doing their job. your lower back picked up the slack — every step, every sit, every lift." / "the tight muscle isn't the problem. it's overworked because something else stopped working." / "your pelvis tilts the same direction every time you sit. same joint, same compression, all day."

SLIDE 4 — TEACHING CONTENT PT. 2 (pattern interrupt)
Second insight — builds on slide 3 with a "but here's where most people get it wrong" moment. A surprising angle, a counterintuitive fact, or the thing that makes it keep coming back. Keep it sharp. 8–18 words.
Examples: "most people stretch the tight spot. the tight spot is already overworked. stretching it doesn't fix why it's overworked." / "strengthening your core doesn't help if your glutes never fire. your lower back keeps compensating either way." / "the nerve stays sensitized long after the tissue heals. that's why it flares from almost nothing."

SLIDE 5 — COMMON MISTAKES
2–3 specific traps people with back pain fall into. Reframe with logic — not negativity. Tie back to the core insight from slides 3–4. Should feel like: "I used to do this too." Conversational, slightly self-aware. 10–20 words.
Examples: "the three things keeping it stuck: only stretching, never finding the cause, and assuming rest fixes it." / "most people rest when it flares. rest resets the symptom — not the pattern that caused it."

SLIDE 6 — CORRECTION (what to do instead)
Right vs. wrong shown clearly. "If you're doing this, here's the fix" framing — actionable without being preachy. One specific correction that directly relates to the hook and teaching content. 8–18 words.
Examples: "if you've been foam rolling the same spot for months and it keeps coming back — you're treating the symptom, not the source." / "stop stretching the tight side. start asking what's overloading it." / "instead of resting through the flare, track what triggered it. that's the actual data."

SLIDE 7 — SMALL WIN / RESOLUTION
One thing they can do or notice immediately. Small, concrete, feels like real progress is possible. Close with conviction — short, confident, clean. No CTA (added separately). 6–14 words.
Examples: "start noticing when it flares. time of day, what came before, how long you sat." / "one shift: before you stretch, ask what's causing the tightness." / "track two things this week: when it hurts and what came before it."

====================================
EMOTIONAL SPECIFICITY
====================================

Use hyper-specific experiences people instantly recognize:
- lower back tightening after sitting
- feeling fine until late afternoon
- one hip always tighter
- stretching helping temporarily
- back locking up when standing
- random flareups
- waking up stiff
- pain moving around
- lower back taking over during lifts
- feeling fragile after long workdays

====================================
HOOK STRATEGY
====================================

NEVER use: "5 tips for back pain", "exercises for posture", "how to fix pain".

CRITICAL: Slide 1 MUST explicitly name "back", "back pain", or a specific back-related symptom (lower back, spine, etc.). The viewer needs to self-identify immediately — this is a back pain channel. Hooks that say "your pain" or "your body" without naming the back will lose the audience before they swipe.

Hooks that work name the back AND create tension:
- "your back pain isn't coming from your back"
- "the real reason your back keeps flaring up"
- "why your lower back hurts after doing nothing"
- "your back's been compensating for years"
- "your back pain isn't random"
- "why stretching your back never actually fixes it"
- "your back is taking the hit for everything else"
- "the pattern behind your back pain flare-ups"
- "why your back locks up every time you sit"
- "your lower back is telling you something"

Slides 2+ can drop the explicit "back" reference once context is established — that's fine and keeps the copy feeling human. But slide 1 must make it unmistakably clear this is about back pain.

====================================
FIRST-PERSON vs. SECOND-PERSON
====================================

Do NOT default to all "you" language. The most viral slideshows oscillate between first-person and second-person.

First-person ("I") creates the feeling of a real person's story — it drives shares because it feels authentic and human, not branded.
Second-person ("you") creates direct identification — the viewer feels seen and called out.

Alternate between them naturally within the slideshow. Never stay in one voice for more than 2 slides in a row.

GOOD oscillation:
- "your back's been compensating for years." (you)
- "I didn't realize it until I started tracking." (I)
- "your pain probably follows a pattern." (you)
- "mine got worse every time I sat for more than an hour." (I)
- "you just haven't connected it yet." (you)

First-person lines are especially powerful for: open loops, realizations, personal discoveries, moments of recognition.
Second-person lines are especially powerful for: hooks, calling out patterns, direct emotional hits.

====================================
SLIDE 2 RETENTION RULE
====================================

Slide 2 is the retention cliff. Most viewers decide to keep swiping or not based on slide 2 alone.

Slide 2 is the VALUE PROMISE — it tells the viewer exactly what they're about to get and makes them feel it's worth their time. It should create a sense of: "this person actually knows what they're talking about and is about to tell me something I need to hear."

GOOD slide 2s:
- "I'm going to show you exactly why it keeps coming back — and it's not what you think."
- "by the end of this you'll understand the actual pattern behind your flare-ups."
- "this is the thing nobody explains about chronic back pain."
- "most people never figure this out. here's what's actually going on."

BAD slide 2s:
- "mine always got worse mid-afternoon." (emotional mirror — save this energy for comment bait elsewhere)
- "tight hip flexors are often the culprit." (jumps to teaching before earning it)
- "here are 5 things to know." (list format kills the momentum)

====================================
COMMENT BAIT
====================================

Comments are a top algorithmic signal. The best comment-driving technique is NOT "comment below!" — it's writing something so hyper-specific that people feel compelled to confirm it happened to them.

At least one slide per slideshow should be specific enough to trigger "literally me" or "omg this is exactly it" comments organically.

The most comment-generating formats:
- A single body symptom named with extreme specificity: "always the left hip." / "stiff every single morning." / "fine until I sit down, then locked up."
- A frustrating pattern: "I'd feel better for a week then it'd come back."
- A moment of misplaced blame: "I thought it was my mattress."
- A realization: "turns out I'd been ignoring it for two years."

These lines work because readers feel the urge to confirm: "yes, this is me" — and the lowest-friction way to do that is to comment.

Embed the comment bait naturally — never as a question directed at the audience, never as "can you relate?" Always as a statement specific enough that agreement feels irresistible.

The target audience: younger adults (18–35), desk workers, gym-goers, people with recurring/chronic back pain frustrated because it "randomly comes and goes", people who feel stuck despite stretching.

The app being promoted is StabilityAI — AI-powered back pain tracking focused on: daily check-ins, identifying triggers, uncovering hidden patterns, personalized routines, understanding WHY pain flares up.`;

    const prompt = `${isVirality ? VIRALITY_SYSTEM + '\n\n' : ''}You are a viral TikTok content strategist. Create a ${slide_count}-slide photo slideshow for TikTok about: "${topic}"
${niche ? `Niche: ${niche}` : ''}
${tone ? `Tone: ${tone}` : ''}
${audience ? `Target audience: ${audience} — write text from their perspective and use image_search terms that feature this type of person (e.g. if audience is "woman", image searches should feature women; if "older man", feature older men, etc.)` : ''}
Template: ${template ?? 'Dark Cinematic'}

Return ONLY valid JSON with this exact structure:
{
  "title": "Short post title (max 8 words)",
  "caption": "#hashtag1 #hashtag2",
  "hashtags": [],
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

CRITICAL: caption must be ONLY two relevant hashtags, nothing else. Format: "#hashtag1 #hashtag2". No sentences, no description, no extra text.
CRITICAL: hashtags array must be empty [].
CRITICAL: Slide 1 is ALWAYS the hook/title slide — the single most compelling line that makes someone stop scrolling. It sets the premise for everything that follows.
CRITICAL: Slide 1's image_search MUST always be exactly "faceless ugc selfie" — no exceptions.

${isOrganic ? `ORGANIC RAW rules — follow these exactly:
- Headlines use lowercase only, never ALL CAPS. Slide 1 is always the hook — no number prefix. For slides 2 onward, prefix each tip/point with its sequential tip number starting from 1 (e.g. slide 2 gets "1. i stopped doing x", slide 3 gets "2. i learned y"). Short, punchy, reads like a real person talking. Max 10 words.
- Body text is conversational — 1-2 short sentences, sounds like a phone caption. No buzzwords. Keep each sentence on its own line (use \\n between sentences).
- image_search: 2-4 word Pinterest aesthetic term — short, vibe-based. Examples: "morning stretch aesthetic", "gym iphone photo", "couch lifestyle candid", "running outdoor aesthetic", "home workout natural light". NO long sentences, NO stock-photo language.`
: isEvidence ? `EVIDENCE BASED rules — follow these exactly:
- Headlines use lowercase only, never ALL CAPS. Slide 1 is the hook — lead with a surprising or counterintuitive fact (e.g. "your spine doesn't actually weaken with age" or "sitting isn't what's causing your back pain"). Slides 2+ prefix with sequential number starting from 1. Max 10 words per headline.
- Body text is educational and specific — 2 sentences max. Explain the mechanism, cite a number or anatomical detail, or reference what research shows. Write like a knowledgeable friend explaining something they just read, NOT a motivational coach. No buzzwords like "transform", "unlock", "game-changer", "you need to". Just facts and mechanisms.
- Never tell the viewer what to do — present information and let them draw conclusions. No "you should", "stop doing X", "start doing Y".
- image_search: same aesthetic as Organic Raw — short, candid, vibe-based. Examples: "morning stretch aesthetic", "gym iphone photo", "home workout natural light", "physical therapy clinic", "anatomy diagram minimal". NO stock-photo language.`
: isVirality ? `VIRALITY OPTIMIZED rules — generate EXACTLY 7 slides:

SLIDE 1 (hook): Names "back" or "back pain" explicitly. Emotional or curiosity-driven tension. 4–10 words.
SLIDE 2 (value promise): What they'll learn and why it matters. One clear promise. Gives them a reason to keep swiping. 8–16 words.
SLIDE 3 (teaching pt. 1): First real insight — specific and substantive. Names what is actually happening, not vague emotional language. 8–18 words.
SLIDE 4 (teaching pt. 2 — pattern interrupt): Second insight. A "but here's where most people get it wrong" moment. Counterintuitive, sharp. Builds on slide 3. 8–18 words.
SLIDE 5 (common mistakes): 2–3 specific traps people fall into. Logical reframe, not negative. First-person voice works well. 10–20 words.
SLIDE 6 (correction): "If you're doing this, here's the fix" framing. One specific, actionable correction tied to the hook and teaching content. 8–18 words.
SLIDE 7 (small win): One concrete thing they can do or notice right now. Short, confident, clean. No CTA. 6–14 words.

ALL slides:
- Lowercase only. Never ALL CAPS. Never clinical-sounding.
- Alternate between first-person ("I") and second-person ("you") — never more than 2 consecutive slides in the same voice.
- Body text: use sparingly. 1 sentence max, 10 words or fewer. Use it to add a second layer — a specific detail, a stat, a personal moment — not to repeat the headline.
- image_search: 2–4 word vibe-based aesthetic term. Examples: "morning stretch aesthetic", "desk worker lifestyle", "gym iphone candid", "home workout natural light", "sitting posture candid".`
: `Rules:
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
