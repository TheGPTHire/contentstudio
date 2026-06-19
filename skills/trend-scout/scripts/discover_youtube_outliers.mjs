// Trend Scout — DISCOVERY mode.
// Finds small creators you HAVEN'T enlisted who are popping off, via niche search.
//
// Two passes (so we can report a real "views / channel median" multiplier for
// channels we have no history on):
//   1. SEARCH the niche terms -> collect recent videos from SMALL channels not on
//      your watchlist. Rank candidate channels by views-to-subscriber ratio (V/S).
//   2. DEEP-SCAN the top candidate channels -> scrape their recent videos, compute
//      the true median, and keep videos clearing the (low) discovery multiplier.
//
// Usage: node skills/trend-scout/scripts/discover_youtube_outliers.mjs [--results 15] [--deep 6] [--top 8]
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { ACTORS, runActor, pick, daysSince, introTranscript } from '../../../lib/apify.mjs';
import { scoreOutliers } from '../../../lib/score.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const perTerm = parseInt(arg('results', '15'), 10);
const deepN = parseInt(arg('deep', '6'), 10);
const topN = parseInt(arg('top', '8'), 10);
const today = new Date().toISOString().slice(0, 10);

const cfg = {
  minMultiplier: Number(process.env.DISCOVERY_MIN_MULTIPLIER || 1.3), // low bar by design
  maxSubs: Number(process.env.DISCOVERY_MAX_SUBS || 50000),           // "small" channels only
  lookbackDays: Number(process.env.OUTLIER_LOOKBACK_DAYS || 45),
  minViews: Number(process.env.DISCOVERY_MIN_VIEWS || 1000),          // lower floor — small creators
};

const norm = (v) => ({
  title: pick(v, ['title']),
  url: pick(v, ['url', 'videoUrl']),
  views: Number(pick(v, ['viewCount', 'views'], 0)) || 0,
  publishedAt: pick(v, ['date', 'publishedAt', 'uploadDate']),
  daysSince: daysSince(pick(v, ['date', 'publishedAt', 'uploadDate'])),
  channelName: pick(v, ['channelName', 'channel']),
  channelId: pick(v, ['channelId', 'channelUrl', 'channelName']),
  channelUrl: pick(v, ['channelUrl']),
  channelUsername: pick(v, ['channelUsername']),
  channelSubs: Number(pick(v, ['numberOfSubscribers', 'channelSubscribers'], 0)) || 0,
  thumbnail: pick(v, ['thumbnailUrl', 'thumbnail']),
});

const handleOf = (s) => String(s || '').toLowerCase().replace(/^@/, '').replace(/\/$/, '').split('/').pop();

async function searchTerm(term) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}&sp=CAI%253D`;
  const raw = await runActor(ACTORS.youtube, { startUrls: [{ url }], maxResults: perTerm });
  return raw.map(norm).filter((v) => v.url);
}

async function scrapeChannel(url) {
  const raw = await runActor(ACTORS.youtube, { startUrls: [{ url: url.replace(/\/$/, '') + '/videos' }], maxResults: 20 });
  return raw.map(norm).filter((v) => v.url);
}

async function firstIntro(url) {
  try { return introTranscript(await runActor(ACTORS.transcript, { videoUrl: url }, { timeoutSecs: 120 }), 30); }
  catch { return ''; }
}

async function main() {
  mkdirSync('data/daily', { recursive: true });
  const { channels, search_terms } = JSON.parse(readFileSync('config/influencers.json', 'utf8'));
  const exclude = new Set((channels || []).map((c) => handleOf(c.handle)));
  const terms = search_terms || [];

  console.log(`→ Discovering via ${terms.length} search terms (${perTerm} results each) ...`);
  let found = [];
  for (const term of terms) {
    try { const r = await searchTerm(term); found = found.concat(r); console.log(`  ✓ "${term}": ${r.length}`); }
    catch (e) { console.log(`  x "${term}": ${String(e.message).slice(0, 70)}`); }
  }

  // Candidate small-channel breakouts NOT already on the watchlist.
  const candidates = found.filter((v) =>
    v.channelSubs > 0 && v.channelSubs <= cfg.maxSubs &&
    v.views >= cfg.minViews &&
    (v.daysSince == null || v.daysSince <= cfg.lookbackDays) &&
    !exclude.has(handleOf(v.channelUsername)) && !exclude.has(handleOf(v.channelUrl))
  ).map((v) => ({ ...v, vsRatio: +(v.views / Math.max(v.channelSubs, 1)).toFixed(2) }));

  // Rank channels by their best V/S ratio, pick the top to deep-scan.
  const best = {};
  for (const v of candidates) {
    const k = v.channelId || v.channelName;
    if (!best[k] || v.vsRatio > best[k].vsRatio) best[k] = v;
  }
  const topChannels = Object.values(best).sort((a, b) => b.vsRatio - a.vsRatio).slice(0, deepN);
  console.log(`\n→ ${candidates.length} candidate videos across ${Object.keys(best).length} new small channels. Deep-scanning top ${topChannels.length} ...`);

  // Deep-scan -> real median -> real multiplier.
  let deepVids = [];
  for (const c of topChannels) {
    const url = c.channelUrl || (c.channelUsername ? `https://www.youtube.com/@${handleOf(c.channelUsername)}` : null);
    if (!url) continue;
    try { const vids = await scrapeChannel(url); deepVids = deepVids.concat(vids); console.log(`  ✓ ${c.channelName}: ${vids.length} (V/S ${c.vsRatio})`); }
    catch (e) { console.log(`  x ${c.channelName}: ${String(e.message).slice(0, 60)}`); }
  }

  const vsByChannel = Object.fromEntries(topChannels.map((c) => [c.channelId || c.channelName, c.vsRatio]));
  let outliers = scoreOutliers(deepVids, {
    minMultiplier: cfg.minMultiplier, lookbackDays: cfg.lookbackDays,
    smallChannelMaxSubs: cfg.maxSubs, minViews: cfg.minViews,
  }).map((o) => ({ ...o, source: 'discovered', vsRatio: vsByChannel[o.channelId || o.channelName] ?? null }))
    .slice(0, topN);

  console.log(`\n→ ${outliers.length} discovered outliers (>=${cfg.minMultiplier}x own median). Pulling intros ...`);
  for (const o of outliers) { o.intro30s = await firstIntro(o.url); process.stdout.write(o.intro30s ? '.' : 'x'); }

  const file = `data/daily/${today}_discovered_outliers.json`;
  writeFileSync(file, JSON.stringify({ date: today, mode: 'discovery', config: cfg, count: outliers.length, outliers }, null, 2));
  console.log(`\n✓ Saved → ${file}`);
}

main().catch((e) => { console.error('\n✗ ' + e.message); process.exit(1); });
