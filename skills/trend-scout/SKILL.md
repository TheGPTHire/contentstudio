---
name: trend-scout
description: Hunts outlier YouTube videos in the AI niche — videos getting far more views than is normal for their channel, with a deliberate bias toward smaller creators who are popping off. Produces a ranked daily list with first-30s intros for the Intro Dissector. Trigger when the user says "find outliers", "scout trends", "what's popping today", or runs the daily routine.
---

# Trend Scout

You hunt **outlier videos** in the AI niche (AI agency, AI automation, AI agents,
AI news, "how to use AI"). An outlier is a video pulling **far more views than the
channel that made it normally gets** — the VidIQ-style signal. You especially want
**small creators breaking out**, not the same mega-channels every day.

## How the outlier score works (explain this to the user if asked)

For each video: `multiplier = views / channel_median_views`. A 5× multiplier means
the video got 5× the channel's typical views. We also track **velocity**
(views/day since publish) and give a **boost to small channels** (under the sub
threshold in `.env`). Ranking is multiplier-first, with small-channel + velocity as
tie-breakers. Tune the thresholds in `.env`:
`OUTLIER_MIN_MULTIPLIER`, `OUTLIER_LOOKBACK_DAYS`, `SMALL_CHANNEL_MAX_SUBS`.

## Step 1 — Make sure the watchlist is set

`config/influencers.json` holds the channels to watch and niche search terms. Add
the creators the user follows. More channels = better median baselines.

## Step 2 — Run the scout

```
node skills/trend-scout/scripts/fetch_youtube_outliers.mjs --per 20 --top 15
```

Writes `data/daily/<date>_youtube_outliers.json` — a ranked list, each item with:
title, url, views, multiplier, velocity, channel + subs, thumbnail URL, and the
**first ~30s intro transcript** (`intro30s`).

If the scrape returns nothing, check `APIFY_TOKEN` and the watchlist, then fall
back to `WebSearch` for trending titles and note that view-based scoring was
skipped.

## Step 2b — Discovery mode (small creators NOT on the watchlist)

To catch brand-new small creators popping off, also run:
```
node skills/trend-scout/scripts/discover_youtube_outliers.mjs --results 15 --deep 6 --top 8
```
This searches the niche `search_terms` in `config/influencers.json`, finds SMALL channels
(under `DISCOVERY_MAX_SUBS`) not already on your watchlist, deep-scans the most promising
ones, and keeps videos clearing a deliberately LOW bar (`DISCOVERY_MIN_MULTIPLIER`, default
1.3×). Writes `data/daily/<date>_discovered_outliers.json` (each item tagged
`source: "discovered"` with a `vsRatio`). Use long-tail, on-lane search terms — broad terms
(“ai news”) only return mega-channels that get filtered out.

> ⚠️ Cost: discovery roughly doubles Apify usage (search + per-channel deep-scans). On the
> free $5/mo plan, consider running discovery less often than the daily watchlist scout.

## Step 3 — Hand off

Tell the user how many outliers you found and the top 3 by multiplier (with the
small-creator gems called out). Then the **Intro Dissector** and **Packaging
Strategist** take this JSON to extract hook formulas and build the two-column
Notion deliverable (creator's version vs. Suhaib's-style version).

## Notes

- YouTube only for now (per the user's choice). Instagram + X are future modes —
  same scoring, different scrapers.
- Don't copy intros verbatim downstream. We extract the **formula and format**,
  then rewrite in Suhaib's voice.
