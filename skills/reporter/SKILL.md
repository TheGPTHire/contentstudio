---
name: reporter
description: Delivers the day's content package to Notion (an existing database the user owns) and sends an email digest. The final step of the daily pipeline. Trigger after Script Writer, or when the user says "send the report", "deliver to Notion", "email me the digest", or runs the daily pipeline.
---

# Reporter

You deliver the finished daily package to **Notion + email**. You're the last step — assume
the day's files already exist in `data/daily/`.

## Input
- `data/daily/<date>_packaged.json` (two-column packaging)
- `data/daily/<date>_scripts.md` (full intro scripts for the picks)
- `data/daily/<date>_youtube_outliers.json` (raw outlier stats + thumbnails)
- `config/delivery.json` (Notion target id + email recipient)

## Step 1 — Write to Notion (existing DB)
Use the connected **Notion MCP**. Read `config/delivery.json` → `notionTarget.id`. If the
id is empty, ask the user which Notion database/page to use, then save it back to
`config/delivery.json` so future runs are automatic.

For each packaged item, create one Notion page (row) in that database with properties:
- **Date** (today)
- **Outlier title** (Column A title) + **URL**
- **Channel** + **Subs** + **Multiplier** (e.g. "8.2×") + **Views**
- **Hook formula** (from Dissector)
- **Title — As-is** / **Title — Suhaib** (the recommended options)
- **Intro — Suhaib** (the rewritten hook; full script in page body if present)
- **Thumbnail concept** (Column B, tagged for Thumbnail Studio)
- **Recommend** (yes/maybe/skip) + **Why**
- **Voice Score** (the Script Writer's X/12 scorecard result, if the item has a script)
- Put the thumbnail image URL in the page so the creator sees the reference.
If the existing DB lacks a property, adapt to what's there (don't fail) and note the
mismatch in the email so the user can add columns.

## Step 2 — Email digest
Use the connected **Gmail MCP**. Send to `config/delivery.json` → `email.to` with subject
`"<subjectPrefix> — <date>"`. Body (concise, skimmable):
- One-line summary: how many outliers, top multiplier, # of `recommend: yes`.
- Top 3 picks: title → multiplier → your recommended Suhaib title → 1-line why.
- The single best full intro script inline (so he can review from his phone).
- Link to the Notion database.
- Footer: what's still blocked (e.g. "Thumbnails pending Nano Banana key").

## Rules
- Be honest in the digest — if a day is thin (few/no good-fit outliers), say so plainly
  rather than padding. Quality over volume (matches Proof→Authority→Customers).
- Never send the email before the Notion write succeeds (so the link works).
- Keep the email tight — it's a daily glance, not a report to read end-to-end.
