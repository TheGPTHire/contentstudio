# Content Studio

An AI marketing team for the **[Suhaib AI Automation](https://www.youtube.com/@SuhaibAIAutomation)**
YouTube channel. One plugin, a team of agents — each a skill — that learns your
brand voice, hunts outlier videos, dissects winning intros, and packages
titles/thumbnails/scripts in *your* style, delivered daily to Notion + email.

## The team

| Department | Skill | Status |
|---|---|---|
| 🧠 Brand Analyst | `skills/brand-analyst` | ✅ built (foundation) |
| 🔭 Trend Scout (YouTube outliers) | `skills/trend-scout` | ✅ built (foundation) |
| 🔬 Intro Dissector | `skills/intro-dissector` | ⏳ after foundation review |
| 🎁 Packaging Strategist (titles) | `skills/packaging-strategist` | ⏳ |
| 🖼️ Thumbnail Studio (Nano Banana) | `skills/thumbnail-studio` | ⏳ needs Nano Banana key |
| ✍️ Script Writer | `skills/script-writer` | ⏳ |
| ✂️ Editor (Descript) | `skills/editor` | ⏳ needs Descript key |
| 🚀 Publisher (YouTube upload) | `skills/publisher` | ⏳ needs YouTube API |
| 📊 Reporter (Notion + email) | `skills/reporter` | ⏳ |

Daily, an orchestrator runs: **Scout → Dissector → Packaging → Thumbnail → Script
→ Reporter**, then emails you the digest. Editor + Publisher run on demand with a
human approval gate.

## Setup

```
cp .env.example .env      # then paste your APIFY_TOKEN
npm install               # installs dotenv
```

Add the AI creators you follow to `config/influencers.json`, and drop a few
photos of yourself in `assets/photos/` (for the Thumbnail Studio later).

## Run the foundation

```
# 1. Learn your voice (run once, refresh monthly)
node skills/brand-analyst/scripts/fetch_my_channel.mjs --max 50 --transcripts 15
#    → then ask Claude to run the Brand Analyst skill

# 2. Hunt today's outliers
node skills/trend-scout/scripts/fetch_youtube_outliers.mjs --per 20 --top 15
#    → then ask Claude to run Intro Dissector + Packaging Strategist
```

## Outlier scoring

`multiplier = views ÷ channel_median_views`. Flags videos doing far better than
normal *for their channel*, biased toward small creators breaking out. Tune
`OUTLIER_MIN_MULTIPLIER`, `OUTLIER_LOOKBACK_DAYS`, `SMALL_CHANNEL_MAX_SUBS` in `.env`.

## Keys

| Key | Needed for | Have it? |
|---|---|---|
| `APIFY_TOKEN` | Scout + Brand Analyst data | **required now** |
| `OPENROUTER_API_KEY` | optional bulk analysis (Claude does it otherwise) | later |
| `NANO_BANANA_API_KEY` | Thumbnail Studio | later |
| `DESCRIPT_API_KEY` | Editor | later |
| `YOUTUBE_API_KEY` | Publisher | later |
