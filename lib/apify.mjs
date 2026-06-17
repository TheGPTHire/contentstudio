// Shared Apify client for Content Studio.
// Calls Apify actors via the run-sync endpoint and returns dataset items.
// Actor IDs are configurable via env so we can swap scrapers without code changes.
import 'dotenv/config';

const TOKEN = process.env.APIFY_TOKEN;

// Default actors (override in .env if you prefer different ones).
// These are widely-used public YouTube actors on the Apify store.
export const ACTORS = {
  youtube: process.env.APIFY_YT_ACTOR || 'streamers~youtube-scraper',
  transcript: process.env.APIFY_TRANSCRIPT_ACTOR || 'pintostudio~youtube-transcript-scraper',
};

export function requireToken() {
  if (!TOKEN) {
    console.error('\n  ✗ APIFY_TOKEN is missing.');
    console.error('    1. Copy .env.example to .env');
    console.error('    2. Paste your token from apify.com → Settings → Integrations → API token\n');
    process.exit(1);
  }
}

/**
 * Run an Apify actor synchronously and return its dataset items.
 * @param {string} actorId  e.g. ACTORS.youtube
 * @param {object} input    actor-specific input payload
 * @param {object} opts     { timeoutSecs }
 * @returns {Promise<Array>} dataset items
 */
export async function runActor(actorId, input, opts = {}) {
  requireToken();
  const timeout = opts.timeoutSecs || 300;
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${TOKEN}&timeout=${timeout}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify actor ${actorId} failed (${res.status}): ${body.slice(0, 500)}`);
  }
  return res.json();
}

// Small helpers for normalizing scraper output (different actors use different keys).
export const pick = (obj, keys, fallback = null) => {
  for (const k of keys) if (obj?.[k] != null) return obj[k];
  return fallback;
};

export const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.round(ms / 86400000));
};

// The pintostudio transcript actor returns [{ data: [{ start, dur, text }] }].
// Normalize that (and a couple of other common shapes) into a flat segment list.
export const transcriptSegments = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw) && raw[0]?.data) return raw[0].data;       // pintostudio shape
  if (raw?.data && Array.isArray(raw.data)) return raw.data;        // object-wrapped
  if (Array.isArray(raw)) return raw;                                // already flat
  return [];
};

export const segText = (s) => s?.text ?? s?.caption ?? '';
export const segStart = (s) => {
  const v = Number(s?.start ?? s?.offset ?? s?.startMs ?? NaN);
  if (!Number.isFinite(v)) return null;
  return v > 1000 ? v / 1000 : v; // ms → s heuristic
};

export const fullTranscript = (raw) =>
  transcriptSegments(raw).map(segText).join(' ').replace(/\s+/g, ' ').trim();

export const introTranscript = (raw, maxSec = 30) => {
  const segs = transcriptSegments(raw);
  const timed = segs.filter((s) => segStart(s) != null);
  if (timed.length) {
    return timed.filter((s) => segStart(s) <= maxSec).map(segText).join(' ').replace(/\s+/g, ' ').trim();
  }
  // No timestamps → approximate 30s by first ~80 words.
  return segs.map(segText).join(' ').split(/\s+/).slice(0, 80).join(' ').trim();
};
