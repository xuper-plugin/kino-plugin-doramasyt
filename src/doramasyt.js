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

/** The twelve genres the site lists (`/genero/<slug>`), in the order of its menu. */
export const GENRES = [
  { slug: "k-drama", title: "K-Drama" }, { slug: "j-drama", title: "J-Drama" }, { slug: "c-drama", title: "C-Drama" }, { slug: "thai-drama", title: "Thai-Drama" },
  { slug: "romance", title: "Romance" }, { slug: "comedia", title: "Comedia" }, { slug: "drama", title: "Drama" }, { slug: "accion", title: "Acción" },
  { slug: "misterio", title: "Misterio" }, { slug: "fantasia", title: "Fantasía" }, { slug: "historico", title: "Histórico" }, { slug: "escolar", title: "Escolar" },
];

/**
 * The "Capítulos actualizados" cards of the home page, as the shows they belong to: `{ slug, title, episode, poster }`, one per show
 * (the newest episode), newest first. A card links to /ver/<base>-episodio-<n>; the show page is /dorama/<base>-sub-espanol.
 */
export function parseLatestEpisodes(html) {
  const out = [];
  const seen = new Set();
  for (const m of String(html || "").matchAll(/<li\b[^>]*class="[^"]*\bcol\b[^"]*"[^>]*>([\s\S]*?)<\/li>/g)) {
    const href = (/<a\b[^>]*\bhref="([^"]+)"/.exec(m[1]) || [])[1] || "";
    const ep = /\/ver\/([a-z0-9-]+)-episodio-(\d+)\/?(?:[?#].*)?$/i.exec(href);
    if (!ep) continue;
    const slug = ep[1] + "-sub-espanol";
    if (seen.has(slug)) continue;
    seen.add(slug);
    const raw = strip((/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(m[1]) || [])[1]);
    const title = raw.replace(/^Ver\s+/i, "").replace(/\s+Cap[ií]tulo\s+\d+\s*$/i, "").trim();
    if (!title) continue;
    const img = (/<img\b[^>]*\bdata-src="([^"]+)"/.exec(m[1]) || [])[1];
    out.push({ slug, title, episode: Number(ep[2]), poster: img && !/capblank/.test(img) ? new URL(decode(img), SITE + "/").href : undefined });
  }
  return out;
}

/** Facts of a show's page: `{ type, aired, year, minutes }` from its `<dt>…</dt><dd>…</dd>` pairs. */
export function parseFacts(html) {
  const facts = {};
  for (const m of String(html || "").matchAll(/<dt[^>]*>\s*([^<:]+):?\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) facts[strip(m[1]).toLowerCase()] = strip(m[2]);
  const year = (/\b((?:19|20)\d{2})\b/.exec(facts["fecha de emisión"] || facts["fecha de emision"] || "") || [])[1];
  const d = facts["duración"] || facts["duracion"] || "";
  const hours = Number((/(\d+)\s*h/i.exec(d) || [])[1] || 0);
  const mins = Number((/(\d+)\s*min/i.exec(d) || [])[1] || 0);
  return { type: facts["tipo"], year, minutes: hours * 60 + mins || undefined };
}
