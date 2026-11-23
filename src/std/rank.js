// Server order from the resolver (std 1.9.2): kino-resolver's `rank` call scores each hoster by how well it plays (its own
// table, from the playback audit), so every plugin orders its servers alike and one resolver update re-orders them all. A
// resolver without the call (older than 0.0.35) or missing answers null: the plugin keeps its own order.
// The plugin's manifest must list "rank" in its resolver consumes entry's calls.

/** The resolver's score for each of [urls] (same order), or null when it cannot say. */
export async function scoresFromResolver(kino, urls) {
  if (!Array.isArray(urls) || urls.length === 0) return null;
  try {
    const r = await kino.plugins.call("resolver", "rank", { urls: urls.slice(0, 64).map(String) });
    const s = r && Array.isArray(r.scores) ? r.scores : null;
    return s && s.length === Math.min(urls.length, 64) ? s : null;
  } catch (_) { return null; }
}

/**
 * [list] ordered by [groupOf] first (lower first: the person's language, say), then by the resolver's score (higher first),
 * then as it came. Without scores: by group, then as it came. [urlOf] gives an item's embed address.
 */
export async function rankServers(kino, list, urlOf, groupOf = () => 0) {
  const scores = await scoresFromResolver(kino, list.map(urlOf));
  return list
    .map((x, i) => ({ x, i, g: groupOf(x), s: scores && i < scores.length ? scores[i] : 0 }))
    .sort((a, b) => a.g - b.g || b.s - a.s || a.i - b.i)
    .map((o) => o.x);
}
