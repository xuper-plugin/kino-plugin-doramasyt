// @ts-check
// Kino plugin: DoramasYT -- Asian dramas in Spanish (Latino, Castilian or subtitled) from www.doramasyt.com.
// The catalog is the site's own (no TMDB): Home rows are its listings, search is its search, a show's episodes come from its
// caplist, and an episode's players are opened with the extractors in ./extractors (Mp4Upload, LuluVdo, MixDrop, StreamTape).
// Declared hosts: the site, those four players and the pages they redirect to. `streamHosts: "any"` is for the CDNs the files sit on.

import { SITE, slugOf, baseOf, watchUrl, langOf, parseCards, parseShow, parseEpisodeNumbers, parsePlayers, parseIframe } from "./doramasyt.js";
import { extractorFor } from "./extractors/index.js";
import { makeReq, UA } from "./util/http.js";
import { addArt, showArt } from "./art.js";

const RESOLVE_MS = 40000;
const MAX_COPIES = 6;
const CACHE_MS = 10 * 60 * 1000;

// ---- i18n ----

const STRINGS = {
  es: {
    onAir: "En emisión", dramas: "Doramas", movies: "Películas",
    lat: "Latino", esp: "Castellano", sub: "Subtitulado", episode: "Capítulo",
    unavailable: "El servicio no está disponible en este momento.",
    noEpisodes: "No se encontraron capítulos de este dorama.",
    noStreams: "Ningún servidor de este capítulo abrió. Prueba más tarde.",
    heroOnAir: "Doramas en emisión, con capítulos nuevos cada semana.",
  },
  en: {
    onAir: "On air", dramas: "Dramas", movies: "Movies",
    lat: "Latino", esp: "Castilian", sub: "Subtitled", episode: "Episode",
    unavailable: "The service is not available right now.",
    noEpisodes: "No episodes found for this drama.",
    noStreams: "No server of this episode opened. Try again later.",
    heroOnAir: "Dramas on air, with new episodes every week.",
  },
};
const t = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};

// ---- helpers ----

const text = (r) => r.text();

async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...(headers || {}) }, timeoutMs: 15000 });
  if (!r.ok) throw kino.error("unavailable", `DoramasYT ${r.status} ${url}`, { userMessage: t("unavailable") });
  return text(r);
}

/** A listing or search answer kept in memory-friendly storage for a few minutes (small: a page of cards). */
async function cached(key, fn) {
  try {
    const raw = kino.storage.get("c:" + key);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS) return e.v;
  } catch (_) { /* no cache */ }
  const v = await fn();
  try { kino.storage.set("c:" + key, JSON.stringify({ at: Date.now(), v }), { ttlMs: CACHE_MS }); } catch (_) { /* a full storage only costs a refetch */ }
  return v;
}

function toItem(card, kind) {
  const lang = langOf(card.title);
  const badge = lang === "lat" ? t("lat") : lang === "esp" ? t("esp") : t("sub");
  const item = {
    id: (kind === "movie" ? "m-" : "d-") + card.slug,
    ref: (kind === "movie" ? "m:" : "d:") + card.slug,
    title: card.title.replace(/\s+(latino|castellano)$/i, "").trim() || card.title,
    kind,
    badges: [badge],
    lang: lang === "lat" ? "es-419" : lang === "esp" ? "es-ES" : undefined,
  };
  if (card.poster) item.poster = card.poster;
  if (!item.lang) delete item.lang;
  return item;
}

const LISTINGS = {
  emision: { path: "/emision", titleKey: "onAir", kind: "series" },
  doramas: { path: "/doramas", titleKey: "dramas", kind: "series" },
  peliculas: { path: "/doramas?categoria=pelicula", titleKey: "movies", kind: "movie" },
};

async function listing(name, page) {
  const def = LISTINGS[name];
  const url = SITE + def.path + (page > 1 ? (def.path.includes("?") ? "&" : "?") + "page=" + page : "");
  return cached(`${name}:${page}`, async () => parseCards(await getPage(url)));
}

// ---- exports ----

export async function home() {
  const names = Object.keys(LISTINGS);
  const rows = await Promise.all(names.map(async (name) => {
    try {
      const cards = await listing(name, 1);
      const def = LISTINGS[name];
      const items = cards.slice(0, 20).map((c) => toItem(c, def.kind));
      return items.length ? { id: name, title: t(def.titleKey), items, ref: "list:" + name, genre: def.kind === "movie" ? "peliculas" : "series" } : null;
    } catch (e) { kino.log("home row " + name + ": " + (e && e.message)); return null; }
  }));
  const shown = rows.filter(Boolean);
  // The site's own posters are blocked for Kino's image loader (see art.js): TMDB art, spread over the rows so each gets its first cards.
  const order = [];
  for (let i = 0; i < 20; i++) for (const row of shown) if (row.items[i]) order.push(row.items[i]);
  await addArt(order);
  return shown;
}

export async function browse(ref, cursor) {
  const m = /^list:(emision|doramas|peliculas)$/.exec(String(ref || ""));
  if (!m) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const cards = await listing(m[1], page);
  const items = cards.map((c) => toItem(c, LISTINGS[m[1]].kind));
  await addArt(items);
  return { items, next: cards.length >= 24 ? String(page + 1) : undefined };
}

export async function search(arg) {
  const q = String(typeof arg === "string" ? arg : (arg && arg.q) || "").trim();
  if (q.length < 2) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${SITE}/buscar?q=${encodeURIComponent(q)}`)));
  return addArt(cards.slice(0, 40).map((c) => toItem(c, "series")));
}

/** A show's episodes: the page, then the caplist POST with the page's own csrf token (and cookies). */
async function showEpisodes(slug) {
  const url = `${SITE}/dorama/${slug}`;
  const html = await getPage(url);
  const show = parseShow(html);
  if (!show.ajax) throw kino.error("not_found", "no caplist on " + url, { userMessage: t("noEpisodes") });
  const r = await kino.fetch(show.ajax, {
    method: "POST",
    headers: { "User-Agent": UA, "X-Requested-With": "XMLHttpRequest", Referer: url, Origin: SITE, Accept: "application/json, text/javascript, */*; q=0.01" },
    body: { form: { _token: show.token } },
    timeoutMs: 15000,
  });
  if (!r.ok) throw kino.error("unavailable", "caplist " + r.status, { userMessage: t("unavailable") });
  const numbers = parseEpisodeNumbers(await text(r));
  if (!numbers.length) throw kino.error("not_found", "no episodes for " + slug, { userMessage: t("noEpisodes") });
  return { show, numbers };
}

export async function episodes(ref) {
  const slug = /^[dm]:([a-z0-9-]+)$/i.exec(String(ref || ""))?.[1];
  if (!slug) throw kino.error("not_found", "unknown ref: " + ref);
  const { show, numbers } = await showEpisodes(slug);
  const name = show.title.replace(/\s+(latino|castellano)$/i, "").trim();
  const art = await showArt(name || show.title);
  const series = { title: name || undefined, poster: art.poster || show.poster, backdrop: art.backdrop || show.backdrop, overview: show.overview || art.overview || undefined, genres: show.genres.length ? show.genres : undefined, year: art.year, rating: art.rating };
  for (const k of Object.keys(series)) if (series[k] === undefined) delete series[k];
  return {
    series,
    episodes: numbers.map((n) => ({ season: 1, number: n, ref: `e:${slug}:${n}`, title: `${t("episode")} ${n}` })),
  };
}

// ---- resolve ----

/** Server names the extractors know, best first: a direct file beats a playlist beats a page that needs more work. */
const PREFERENCE = [/mp4upload/i, /lulu/i, /streamtape/i, /(mxdrop|mixdrop)/i];
const rank = (name) => { const i = PREFERENCE.findIndex((re) => re.test(name)); return i < 0 ? 99 : i; };
const SERVER_NAMES = { mp4upload: "Mp4Upload", lulu: "LuluVdo", streamtape: "StreamTape", mixdrop: "MixDrop", mxdrop: "MixDrop" };
const prettyName = (name) => { const k = Object.keys(SERVER_NAMES).find((x) => new RegExp(x, "i").test(name)); return k ? SERVER_NAMES[k] : name; };

/** `{ name, value }` players of an episode that a known extractor may open, best first. */
function usable(players) {
  return players.filter((p) => rank(p.name) < 99).sort((a, b) => rank(a.name) - rank(b.name)).slice(0, MAX_COPIES);
}

async function openPlayer(player, req, pageUrl) {
  const frame = await req(`${SITE}/reproductor?video=${encodeURIComponent(player.value)}`, { headers: { Referer: pageUrl } });
  if (!frame.ok) return null;
  const embed = parseIframe(await text(frame));
  if (!embed) return null;
  const ex = extractorFor(embed);
  if (!ex) return null;
  return ex.extract(embed, req, kino);
}

function streamOf(out, lang, name) {
  return { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...(out.headers || {}) }, label: `${t(lang)} · ${prettyName(name)}`, ...(out.subtitles ? { subtitles: out.subtitles } : {}), ...(out.durationMs ? { durationMs: out.durationMs } : {}) };
}

/**
 * `ref` is an episode ("e:<slug>:<n>"), a movie ("m:<slug>", its one episode) or a lazy copy ("c:<slug>:<n>:<i>", the i-th usable
 * player of that episode), which is how the other servers reach the Server menu.
 */
export async function resolve(ref) {
  const m = /^(?:(e):([a-z0-9-]+):(\d+)|(m):([a-z0-9-]+)|(c):([a-z0-9-]+):(\d+):([0-9]))$/i.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  const slug = m[2] || m[5] || m[7];
  const only = m[6] ? Number(m[9]) : null;
  const lang = langOf(slug);
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });

  // A movie is the site's episode 0 (a few are 1); an episode or a copy names its own number.
  // The caplist of a movie says 1 while its page is episodio-0, so a request for episode 1 may land on 0.
  const wantedN = Number(m[3] || m[8]);
  const tries = m[4] ? [0, 1] : wantedN === 1 ? [1, 0] : [wantedN];
  let number = tries[0], pageUrl = watchUrl(slug, number), html = null, lastError = null;
  for (const n of tries) {
    number = n; pageUrl = watchUrl(slug, n);
    try { html = await getPage(pageUrl, { Referer: `${SITE}/dorama/${slug}` }); break; } catch (e) { lastError = e; }
  }
  if (html == null) throw lastError;
  const players = usable(parsePlayers(html));
  if (!players.length) throw kino.error("not_found", "no usable players on " + pageUrl, { userMessage: t("noStreams") });

  const order = only != null ? [only] : players.map((_, i) => i);
  const failures = [];
  for (const i of order) {
    const player = players[i];
    if (!player) continue;
    try {
      const out = await openPlayer(player, req, pageUrl);
      if (!out) { failures.push(`${player.name}: no stream`); continue; }
      const stream = streamOf(out, lang, player.name);
      if (only == null) {
        const others = players.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${slug}:${number}:${j}`, label: `${t(lang)} · ${prettyName(players[j].name)}` }));
      }
      return stream;
    } catch (e) {
      failures.push(`${player.name}: ${(e && e.message) || e}`);
    }
  }
  kino.log("resolve " + baseOf(slug) + " " + number + " failed: " + failures.join("; "));
  throw kino.error("not_found", "no player opened for " + pageUrl, { userMessage: t("noStreams") });
}
