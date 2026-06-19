---
name: daily-run
description: Runs the full Content Studio daily pipeline end to end — Trend Scout → Intro Dissector → Packaging Strategist → Script Writer → Reporter (Notion + email). Trigger when the user says "run the daily", "do today's content", "run content studio", or when a scheduled task fires.
---

# Daily Run — Content Studio orchestrator

Run the whole team in order for today. Work from the project root
`C:\Users\Arsha\ContentStudio`. Stop and report if a step yields nothing usable.

**All writing (titles, hooks, scripts) is governed by `data/profiles/brand-voice-profile.md`
(WHO/WHAT) + `data/profiles/copywriting-style-guide.md` (HOW — strong-POV operator ×
provocative challenger). Every script passes the Voice Scorecard quality gate (≥8/12).**

## Pipeline

1. **Trend Scout — watchlist:** scrape + score outliers from enlisted channels:
   ```
   node skills/trend-scout/scripts/fetch_youtube_outliers.mjs
   ```
   Produces `data/daily/<date>_youtube_outliers.json` (tag these `source: watchlist`). If 0
   outliers, lower `OUTLIER_MIN_MULTIPLIER` in `.env` or widen `OUTLIER_LOOKBACK_DAYS`,
   retry once.

1b. **Trend Scout — discovery:** find small creators NOT on the watchlist:
   ```
   node skills/trend-scout/scripts/discover_youtube_outliers.mjs
   ```
   Produces `data/daily/<date>_discovered_outliers.json` (already tagged `source: discovered`
   with `vsRatio`). On the free Apify tier this may be skipped some days to conserve credits
   — if it errors on budget, note it and continue with watchlist outliers only.

2. **Intro Dissector** — run the `intro-dissector` skill on BOTH outlier files (merge them,
   keep the `source` tag) → `data/daily/<date>_dissected.json`.

3. **Packaging Strategist** — run the `packaging-strategist` skill on the dissected file →
   `data/daily/<date>_packaged.json` (the two-column deliverable).

4. **Script Writer** — run the `script-writer` skill on the `recommend: yes` items →
   `data/daily/<date>_scripts.md`.

5. **Reporter** — run the `reporter` skill → write to Notion + email the digest.

## Output to the user
A short chat summary: # outliers, top pick + multiplier, # of `yes` recommendations,
"delivered to Notion + emailed." Note anything blocked (thumbnails/editing/publishing
pending keys).

## Cost note
Apify is on the FREE $5/mo plan. Each full run scrapes 6 channels + a handful of
transcripts. If credits run low, reduce `--per` and `--top` on the Scout step. The
analysis/writing steps (Dissector → Reporter) use Claude + already-connected MCPs — no
extra cost.

## Notes
- Thumbnail Studio, Editor, Publisher are not in this pipeline yet (pending API keys).
  When added, Thumbnail Studio slots in after Packaging; Editor/Publisher run on demand
  with a human approval gate.
