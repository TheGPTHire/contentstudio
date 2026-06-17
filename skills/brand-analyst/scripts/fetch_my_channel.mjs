// Brand Analyst — data collector.
// Scrapes your own channel's videos + transcripts so Claude can derive your
// brand voice. Writes raw JSON to data/profiles/ for the analysis step.
//
// Usage:  node skills/brand-analyst/scripts/fetch_my_channel.mjs [--max 50] [--transcripts 15]
import { writeFileSync, mkdirSync } from 'node:fs';
import { ACTORS, runActor, pick, daysSince, fullTranscript } from '../../../lib/apify.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};

const channelUrl = process.env.MY_CHANNEL_URL || 'https://www.youtube.com/@SuhaibAIAutomation';
const maxVideos = parseInt(arg('max', '50'), 10);
const maxTranscripts = parseInt(arg('transcripts', '15'), 10);

const normVideo = (v) => ({
  title: pick(v, ['title']),
  url: pick(v, ['url', 'videoUrl']),
  views: Number(pick(v, ['viewCount', 'views'], 0)) || 0,
  likes: Number(pick(v, ['likes', 'likeCount'], 0)) || 0,
  comments: Number(pick(v, ['commentsCount', 'comments'], 0)) || 0,
  publishedAt: pick(v, ['date', 'publishedAt', 'uploadDate']),
  daysSince: daysSince(pick(v, ['date', 'publishedAt', 'uploadDate'])),
  durationSec: Number(pick(v, ['duration', 'lengthSeconds'], 0)) || 0,
  channelName: pick(v, ['channelName', 'channel']),
  channelSubs: Number(pick(v, ['numberOfSubscribers', 'channelSubscribers'], 0)) || 0,
  thumbnail: pick(v, ['thumbnailUrl', 'thumbnail']),
  description: pick(v, ['text', 'description']),
});

async function main() {
  mkdirSync('data/profiles', { recursive: true });
  console.log(`→ Scraping up to ${maxVideos} videos from ${channelUrl} ...`);

  // Note: pull both long-form (/videos) and Shorts (/shorts) — small channels
  // often live mostly on Shorts. (sortVideosBy:'POPULAR' returns 0 on this actor.)
  const base = channelUrl.replace(/\/$/, '');
  const longs = await runActor(ACTORS.youtube, {
    startUrls: [{ url: base + '/videos' }],
    maxResults: maxVideos,
    maxResultsShorts: 0,
  });
  const shorts = await runActor(ACTORS.youtube, {
    startUrls: [{ url: base + '/shorts' }],
    maxResults: maxVideos,
  });
  const videos = [...longs, ...shorts].map(normVideo).filter((v) => v.url);
  writeFileSync('data/profiles/raw_channel.json', JSON.stringify(videos, null, 2));
  console.log(`✓ Saved ${videos.length} videos → data/profiles/raw_channel.json`);

  // Transcripts for the top videos (best signal for voice). Top by views.
  const top = [...videos].sort((a, b) => b.views - a.views).slice(0, maxTranscripts);
  console.log(`→ Fetching transcripts for top ${top.length} videos ...`);
  const transcripts = [];
  for (const v of top) {
    try {
      const t = await runActor(ACTORS.transcript, { videoUrl: v.url }, { timeoutSecs: 120 });
      const text = fullTranscript(t);
      transcripts.push({ title: v.title, url: v.url, views: v.views, transcript: text });
      process.stdout.write('.');
    } catch (e) {
      transcripts.push({ title: v.title, url: v.url, views: v.views, transcript: '', error: String(e).slice(0, 120) });
      process.stdout.write('x');
    }
  }
  writeFileSync('data/profiles/transcripts.json', JSON.stringify(transcripts, null, 2));
  console.log(`\n✓ Saved ${transcripts.length} transcripts → data/profiles/transcripts.json`);
  console.log('\nNext: ask Claude to run the Brand Analyst skill to build your Brand Voice Profile.');
}

main().catch((e) => {
  console.error('\n✗ ' + e.message);
  process.exit(1);
});
