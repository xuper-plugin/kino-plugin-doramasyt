// Cover art. doramasyt.com puts its posters behind Cloudflare, which answers 403 to the HTTP client Kino loads images with
// (okhttp; a browser User-Agent passes, okhttp and curl do not), and a plugin cannot send headers with an image. So the art
// comes from TMDB, found by title: one /search/multi per title, kept 30 days in kino.storage (a miss 2 days), spread over the
// calls Kino lets a plugin make (20 every 10 s).

const IMG = "https://image.tmdb.org/t/p/";
const DAY_MS = 24 * 60 * 60 * 1000;
const HIT_MS = 30 * DAY_MS;
const MISS_MS = 2 * DAY_MS;
/** TMDB lookups (not counting cache hits) one call may spend: Home, a page of a listing or a search. */
// "art2:": the first version of the matching could keep the wrong show of two with one name for 30 days.
const KEY = "art2:";
const BUDGET = 24;
const BATCH = 8;

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** A title as the two sides can agree on it: no accents, no "(2024)", no Latino/Castellano tag, no punctuation. */
export const norm = (s) => fold(s).replace(/\(\d{4}\)/g, " ").replace(/\b(latino|castellano|sub espanol)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/** kino.tmdb, asking again after a short wait when Kino's limit is spent; null when this Kino has no kino.tmdb. */
async function tmdb(path, params) {
  if (typeof kino.tmdb !== "function") return null;
  for (let attempt = 0; ; attempt++) {
    try {
      return await kino.tmdb(path, params);
    } catch (e) {
      if (!e || e.code !== "rate_limited" || attempt >= 2) throw e;
      await kino.sleep(1200 * (attempt + 1));
    }
  }
}

// The site lists Asian dramas by their English or romanised name, TMDB (es-MX) answers with the Spanish one, so the names often differ
// even for the right show. The first hits of a search are ranked by relevance (alternative titles count), and a drama's original
// language is an Asian one, so that is accepted when no name matches.
const ASIAN = new Set(["ko", "ja", "zh", "cn", "th", "id", "vi", "tl", "ms", "hi"]);
// Where two shows share a name (a Korean drama and its Philippine remake), the site's catalogue is mostly these.
const CORE = new Set(["ko", "ja", "zh", "cn", "th"]);

/**
 * The result that is this title: an exact name (an Asian original first when two shows share it), then one name containing the other,
 * and, only when `loose`, the top Asian-language hit; null when none is close.
 */
export function pickResult(results, title, { loose = true } = {}) {
  const q = norm(title);
  if (!q) return null;
  const usable = (Array.isArray(results) ? results : []).filter((r) => r && (r.media_type === "tv" || r.media_type === "movie" || r.media_type === undefined) && r.poster_path);
  const names = (r) => [r.name, r.title, r.original_name, r.original_title].map(norm).filter(Boolean);
  const exact = usable.slice(0, 6).filter((r) => names(r).includes(q));
  const byName = exact.find((r) => CORE.has(r.original_language)) || exact[0]
    || usable.slice(0, 3).find((r) => names(r).some((n) => n.length >= 4 && q.length >= 4 && (n.includes(q) || q.includes(n))))
    || null;
  if (byName || !loose) return byName;
  return usable.slice(0, 2).find((r) => ASIAN.has(r.original_language)) || null;
}

const read = (key) => {
  try { const raw = kino.storage.get(key); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
};
const write = (key, v, ttlMs) => {
  try { kino.storage.set(key, JSON.stringify(v), { ttlMs }); } catch (_) { /* a full storage only costs a lookup next time */ }
};

/** `{ poster?, backdrop?, year?, rating?, overview? }` for a title, from the cache when it was looked up; undefined when it must be asked. */
export const cachedArt = (title) => read(KEY + norm(title));

/** Looks the title up on TMDB and keeps the answer. Throws `rate_limited` when Kino's limit is spent, so the caller can stop. */
export async function lookupArt(title) {
  const key = KEY + norm(title);
  const hit = read(key);
  if (hit) return hit;
  const query = String(title).slice(0, 120);
  const res = await tmdb("/search/multi", { query, language: "es-MX" });
  if (res === null) return {};
  // TMDB names a show in the language of the request, and the site writes the English or romanised name: an English title finds
  // the Korean drama only by its English name, and by the Spanish one it finds a remake that kept the name. So when the Spanish
  // answer has no Asian original by name, the same search is made in English and its answer is the one that counts.
  let r = pickResult(res && res.results, title, { loose: false });
  if (!r || !CORE.has(r.original_language)) {
    const en = await tmdb("/search/multi", { query, language: "en-US" });
    const r2 = pickResult(en && en.results, title, { loose: false });
    if (r2 && (CORE.has(r2.original_language) || !r)) r = r2;
  }
  if (!r) r = pickResult(res && res.results, title);
  const art = r
    ? {
      poster: IMG + "w500" + r.poster_path,
      ...(r.backdrop_path ? { backdrop: IMG + "w780" + r.backdrop_path } : {}),
      ...(/^\d{4}/.test(r.first_air_date || r.release_date || "") ? { year: String((r.first_air_date || r.release_date).slice(0, 4)) } : {}),
      ...(r.vote_average > 0 ? { rating: Math.round(r.vote_average * 10) / 10 } : {}),
      ...(r.overview ? { overview: String(r.overview).slice(0, 600) } : {}),
    }
    : {};
  write(key, art, r ? HIT_MS : MISS_MS);
  return art;
}

const apply = (item, art) => {
  if (art.poster) item.poster = art.poster;
  if (art.year && !item.year) item.year = art.year;
  if (art.rating && !item.rating) item.rating = art.rating;
};

/**
 * Puts TMDB art on `items` (objects with a `title`), in the order given: cached ones first (free), then up to BUDGET lookups, BATCH at
 * a time. A title with no match keeps whatever poster it had. Never throws: the list is shown with or without art.
 */
export async function addArt(items) {
  const todo = [];
  for (const item of items) {
    const hit = cachedArt(item.title);
    if (hit) apply(item, hit);
    else todo.push(item);
  }
  let spent = 0;
  let found = 0;
  const say = (msg) => { try { kino.log("art: " + msg); } catch (_) { /* no log */ } };
  say(`${items.length - todo.length} cached, ${todo.length} to look up, kino.tmdb is ${typeof kino.tmdb}`);
  try {
    while (todo.length && spent < BUDGET) {
      const batch = todo.splice(0, Math.min(BATCH, BUDGET - spent));
      spent += batch.length;
      // allSettled: the ones that answered keep their art even when a later one hits Kino's limit; then the loop stops
      const arts = await Promise.allSettled(batch.map((item) => lookupArt(item.title)));
      let stop = null;
      arts.forEach((a, i) => { if (a.status === "fulfilled") { apply(batch[i], a.value); if (a.value && a.value.poster) found++; } else stop = stop || a.reason; });
      if (stop) throw stop;
    }
  } catch (e) {
    say("stopped (" + ((e && e.code) || (e && e.message)) + ")");
  }
  say(`${spent} looked up, ${found} with a poster`);
  return items;
}

/** Art for one show (its page): the poster and the background, and the synopsis when the site gave none. */
export async function showArt(title) {
  try { return await lookupArt(title); } catch (_) { return {}; }
}
