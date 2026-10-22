// DoramasYT (www.doramasyt.com): Asian dramas in Spanish. Pages: /dorama/<slug> (the show), /ver/<base>-episodio-<n> (an episode),
// listings /emision, /doramas and /doramas?categoria=pelicula (24 cards a page, ?page=N), search /buscar?q=.
// The episode numbers come from a small POST (`.caplist[data-ajax]`, with the page's csrf token); the players of an episode are
// `button.play-video[data-player]`, an encrypted value that /reproductor?video=<value> turns into the embed's iframe.

export const SITE = "https://www.doramasyt.com";

const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).trim();
const strip = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

/** The slug of a `/dorama/<slug>` address, or null. */
export const slugOf = (href) => (/\/dorama\/([a-z0-9-]+)\/?(?:[?#].*)?$/i.exec(String(href || "")) || [])[1] || null;

/** The base of an episode address: a show slug without its "-sub-espanol" tail. */
export const baseOf = (slug) => String(slug || "").replace(/-sub-espanol$/, "");

export const watchUrl = (slug, n) => `${SITE}/ver/${baseOf(slug)}-episodio-${Number(n)}`;

/** `lat` for a show the site names Latino or Castellano, `sub` otherwise. */
export const langOf = (text) => (/\blatino\b/i.test(text) ? "lat" : /\bcastellano\b/i.test(text) ? "esp" : "sub");

/** The cards of a listing or search page: `{ slug, title, poster }`; a card that is not a show is left out. */
export function parseCards(html) {
  const out = [];
  const seen = new Set();
  for (const m of String(html || "").matchAll(/<li\b[^>]*class="[^"]*\bcol\b[^"]*"[^>]*>([\s\S]*?)<\/li>/g)) {
    const slug = slugOf((/<a\b[^>]*\bhref="([^"]+)"/.exec(m[1]) || [])[1]);
    const title = strip((/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(m[1]) || [])[1]);
    if (!slug || !title || seen.has(slug)) continue;
    const img = (/<img\b[^>]*\bdata-src="([^"]+)"/.exec(m[1]) || /<img\b[^>]*\bsrc="([^"]+)"/.exec(m[1]) || [])[1];
    seen.add(slug);
    out.push({ slug, title, poster: img && !/capblank/.test(img) ? new URL(decode(img), SITE + "/").href : undefined });
  }
  return out;
}

/** What a show's page says about it. */
export function parseShow(html) {
  const s = String(html || "");
  const grab = (re) => strip((re.exec(s) || [])[1]);
  const imgs = [...s.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]).map((tag) => ({ cls: (/\bclass="([^"]*)"/.exec(tag) || [])[1] || "", src: (/\bdata-src="([^"]+)"/.exec(tag) || /\bsrc="([^"]+)"/.exec(tag) || [])[1] }));
  const poster = (imgs.find((i) => /\brounded-3\b/.test(i.cls) && i.src) || {}).src;
  const backdrop = (imgs.find((i) => /\bw-100\b/.test(i.cls) && !/\brounded-3\b/.test(i.cls) && i.src && !/capblank/.test(i.src)) || {}).src;
  const abs = (u) => (u && !/capblank/.test(u) ? new URL(decode(u), SITE + "/").href : undefined);
  const genres = [...s.matchAll(/<a\b[^>]*\bhref="[^"]*\/genero\/[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/g)].map((m) => decode(m[1])).filter(Boolean);
  return {
    title: grab(/class="[^"]*\bfs-2\b[^"]*"[^>]*>([\s\S]*?)<\//),
    overview: grab(/<div class="[^"]*\bmb-3\b[^"]*"[^>]*>([\s\S]*?)<\/div>/).replace(/\s*Ver menos\s*$/i, ""),
    poster: abs(poster),
    backdrop: abs(backdrop),
    genres: [...new Set(genres)].slice(0, 6),
    ajax: decode((/\bdata-ajax="([^"]+)"/.exec(s) || [])[1] || ""),
    token: (/<meta\s+name="csrf-token"\s+content="([^"]+)"/.exec(s) || /<meta\s+content="([^"]+)"\s+name="csrf-token"/.exec(s) || [])[1] || "",
  };
}

/** The episode numbers of the caplist answer, ascending and unique. */
export function parseEpisodeNumbers(json) {
  let o = json;
  if (typeof json === "string") { try { o = JSON.parse(json); } catch (_) { return []; } }
  const nums = (o && Array.isArray(o.eps) ? o.eps : []).map((e) => Number(e && e.num)).filter((n) => Number.isFinite(n) && n >= 0);
  return [...new Set(nums)].sort((a, b) => a - b);
}

/** The players of an episode page: `{ name, value }` in the order the site lists them. */
export function parsePlayers(html) {
  const out = [];
  for (const m of String(html || "").matchAll(/<button\b[^>]*\bclass="[^"]*\bplay-video\b[^"]*"[^>]*\bdata-player="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)) {
    const name = strip(m[2]);
    if (name && m[1]) out.push({ name, value: decode(m[1]) });
  }
  return out;
}

/** The embed address a /reproductor page holds in its iframe. */
export function parseIframe(html) {
  const src = (/<iframe\b[^>]*\bsrc="([^"]+)"/i.exec(String(html || "")) || [])[1];
  return src ? decode(src) : null;
}
