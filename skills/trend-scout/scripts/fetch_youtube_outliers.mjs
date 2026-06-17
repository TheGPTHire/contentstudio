// Trend Scout — YouTube outlier hunter.
// Scrapes the channels in config/influencers.json (+ optional niche searches),
// scores every video for "outlier-ness" relative to its own channel, and pulls
// the first ~30s intro transcript of the top hits for the Intro Dissector.
//
// Usage:  node skills/trend-scout/scripts/fetch_youtube_outliers.mjs [--per 20] [--top 15]
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { ACTORS, runActor, pick, daysSince, introTranscript } from '../../../lib/apify.mjs';
import { scoreOutliers } from '../../../lib/score.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const perChannel = parseInt(arg('per', '25'), 10);
const topN = parseInt(arg('top', '12'), 10);
const today = new Date().toISOString().slice(0, 10);

const cfg = {
  minMultiplier: Number(process.env.OUTLIER_MIN_MULTIPLIER || 2.5),
  lookbackDays: Number(process.env.OUTLIER_LOOKBACK_DAYS || 45),
  smallChannelMaxSubs: Number(process.env.SMALL_CHANNEL_MAX_SUBS || 50000),
  minViews: Number(process.env.OUTLIER_MIN_VIEWS || 3000),
};

const toUrl = (h) => (h.startsWith('http') ? h : `https://www.youtube.com/${h}`);

const normVideo = (v) => ({
  title: pick(v, ['title']),
  url: pick(v, ['url', 'videoUrl']),
  views: Number(pick(v, ['viewCount', 'views'], 0)) || 0,
  likes: Number(pick(v, ['likes', 'likeCount'], 0)) || 0,
  publishedAt: pick(v, ['date', 'publishedAt', 'uploadDate']),
  daysSince: daysSince(pick(v, ['date', 'publishedAt', 'uploadDate'])),
  durationSec: Number(pick(v, ['duration', 'lengthSeconds'], 0)) || 0,
  channelName: pick(v, ['channelName', 'channel']),
  channelId: pick(v, ['channelId', 'channelUrl', 'channelName']),
  channelSubs: Number(pick(v, ['numberOfSubscribers', 'channelSubscribers'], 0)) || 0,
  thumbnail: pick(v, ['thumbnailUrl', 'thumbnail']),
});

async function scrapeChannel(url) {
  // Default order on /videos is newest-first. (sortVideosBy returns 0 on this actor.)
  const raw = await runActor(ACTORS.youtube, {
    startUrls: [{ url: url.replace(/\/$/, '') + '/videos' }],
    maxResults: perChannel,
    maxResultsShorts: 0,
  });
  return raw.map(normVideo).filter((v) => v.url);
}

async function firstIntro(url) {
  // Grab the transcript and keep only the opening ~30s (the hook).
  try {
    const t = await runActor(ACTORS.transcript, { videoUrl: url }, { timeoutSecs: 120 });
    return introTranscript(t, 30);
  } catch {
    return '';
  }
}

async function main() {
  mkdirSync('data/daily', { recursive: true });
  const { channels, search_terms } = JSON.parse(readFileSync('config/influencers.json', 'utf8'));
  const watch = (channels || []).filter((c) => c.tier !== 'self');

  console.log(`→ Scouting ${watch.length} channels (${perChannel} videos each) ...`);
  let all = [];
  for (const c of watch) {
    try {
      const vids = await scrapeChannel(toUrl(c.handle));
      all = all.concat(vids);
      console.log(`  ✓ ${c.handle}: ${vids.length} videos`);
    } catch (e) {
      console.log(`  x ${c.handle}: ${String(e.message).slice(0, 80)}`);
    }
  }

  if (!all.length) {
    console.error('\n✗ No videos scraped. Check APIFY_TOKEN and that config/influencers.json has channels.');
    process.exit(1);
  }

  const outliers = scoreOutliers(all, cfg).slice(0, topN);
  console.log(`\n→ Found ${outliers.length} outliers (>=${cfg.minMultiplier}x). Pulling intros ...`);

  for (const o of outliers) {
    o.intro30s = await firstIntro(o.url);
    process.stdout.write(o.intro30s ? '.' : 'x');
  }

  const out = { date: today, config: cfg, count: outliers.length, outliers };
  const file = `data/daily/${today}_youtube_outliers.json`;
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\n✓ Saved → ${file}`);
  console.log('\nNext: ask Claude to run Intro Dissector + Packaging Strategist on this file.');
}

main().catch((e) => {
  console.error('\n✗ ' + e.message);
  process.exit(1);
});
