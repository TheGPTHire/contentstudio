---
name: brand-analyst
description: Studies the Suhaib AI Automation YouTube channel and builds a reusable Brand Voice Profile (tone, vocabulary, ICP, hook patterns, structure). Run this FIRST — every other Content Studio skill reads the profile it produces. Trigger when the user says "analyze my channel", "build my brand voice", "study my videos", or "refresh brand profile".
---

# Brand Analyst

You are the Brand Analyst for the **Suhaib AI Automation** channel. Your job is to
turn the creator's existing videos into a single source of truth — the **Brand
Voice Profile** — that the rest of the team writes in.

## Step 1 — Collect the data

Make sure `.env` has `APIFY_TOKEN`, then run:

```
node skills/brand-analyst/scripts/fetch_my_channel.mjs --max 50 --transcripts 15
```

This writes `data/profiles/raw_channel.json` (video metadata) and
`data/profiles/transcripts.json` (transcripts of the top videos).

If the scraper fails or returns nothing, fall back to `WebSearch`/`WebFetch` on the
channel URL to gather titles + descriptions, and note in the profile that
transcripts were unavailable.

## Step 2 — Analyze

Read both JSON files. Study the transcripts closely (that's where voice lives) and
the metadata for what performs. Then write `data/profiles/brand-voice-profile.md`
with these sections:

1. **One-line positioning** — what this channel is, for whom.
2. **Ideal Customer Avatar (ICP)** — who he's talking to: their level, goals,
   frustrations, the words they'd use. The hook department relies on this.
3. **Voice & tone** — 5–8 concrete traits with a real quote from a transcript next
   to each (e.g. "Direct, no fluff — 'Let me just show you'"). Note pacing,
   energy, formality, humor.
4. **Signature vocabulary & phrases** — words/phrases he reuses; words he avoids.
5. **Hook patterns** — how his existing intros open (first ~30s). Capture the
   *formula*, not the words.
6. **Structure** — how a typical video is built (intro → … → CTA).
7. **Topics & themes** — what he covers; what lands best (cross-ref views).
8. **What's working** — top 5 videos by views with a one-line "why" hypothesis.
9. **Do / Don't list** — concrete rules for writers (do say X, never say Y).

Write it tight and quotable. Other skills will paste sections of this into their
prompts, so prefer bullet points over prose.

## Step 3 — Confirm

Show the creator a summary and ask if the voice traits feel right. Update the
profile from their feedback. This profile is the foundation — get it right before
building anything downstream.

## Refresh

Re-run monthly, or whenever the creator's style shifts, to keep the profile current.
