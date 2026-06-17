// Outlier scoring — the "VidIQ-style" engine.
//
// The core idea: a video is an OUTLIER when it gets far more views than is
// normal *for the channel that made it*. A 50k-view video is unremarkable for a
// 2M-sub channel but a breakout for a 3k-sub channel. We reward exactly that.
//
// Signals combined:
//   1. multiplier   = views / channel_median_views   (the headline "outlier score")
//   2. velocity     = views / days_since_published    (is it popping off NOW?)
//   3. small_boost  = bonus when the channel is small (the "hidden gem" you want)
//
// Final rank = multiplier, with velocity + small-channel boost as tie-breakers.

const median = (nums) => {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};

/**
 * @param {Array} videos  normalized videos: { views, daysSince, channelId, channelSubs, ... }
 * @param {object} cfg    { minMultiplier, lookbackDays, smallChannelMaxSubs }
 * @returns {Array} scored + filtered + ranked videos
 */
export function scoreOutliers(videos, cfg) {
  const minMultiplier = cfg.minMultiplier ?? 5;
  const lookbackDays = cfg.lookbackDays ?? 30;
  const smallMaxSubs = cfg.smallChannelMaxSubs ?? 100000;
  const minViews = cfg.minViews ?? 0; // absolute-views floor: kills tiny-baseline noise

  // Baseline = median views per channel (computed across everything we scraped
  // for that channel, including older videos, so the baseline isn't skewed).
  const byChannel = {};
  for (const v of videos) {
    (byChannel[v.channelId || v.channelName] ||= []).push(v.views);
  }
  const channelMedian = {};
  for (const [ch, views] of Object.entries(byChannel)) channelMedian[ch] = median(views);

  const scored = videos
    .filter((v) => v.daysSince == null || v.daysSince <= lookbackDays)
    .map((v) => {
      const baseline = channelMedian[v.channelId || v.channelName] || v.views || 1;
      const multiplier = baseline > 0 ? +(v.views / baseline).toFixed(2) : 0;
      const velocity = v.daysSince ? Math.round(v.views / Math.max(v.daysSince, 1)) : v.views;
      const isSmall = v.channelSubs != null && v.channelSubs <= smallMaxSubs;
      return { ...v, baseline: Math.round(baseline), multiplier, velocity, isSmall };
    })
    .filter((v) => v.multiplier >= minMultiplier && v.views >= minViews);

  // Rank: outlier multiplier first; small channels and fast velocity break ties.
  scored.sort((a, b) => {
    if (b.multiplier !== a.multiplier) return b.multiplier - a.multiplier;
    if (a.isSmall !== b.isSmall) return a.isSmall ? -1 : 1;
    return b.velocity - a.velocity;
  });

  return scored;
}

export { median };
