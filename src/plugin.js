// @ts-check
// Kino plugin: DoramasYT -- Asian dramas in Spanish (Latino, Castilian or subtitled) from www.doramasyt.com.
// The catalog is the site's own (no TMDB): Home rows are its listings, search is its search, a show's episodes come from its
// caplist, and an episode's players are opened with the extractors in ./extractors (Mp4Upload, LuluVdo, MixDrop, StreamTape).
// Declared hosts: the site, those four players and the pages they redirect to. `streamHosts: "any"` is for the CDNs the files sit on.

import { SITE, GENRES, baseOf, watchUrl, langOf, parseCards, parseShow, parseFacts, parseLatestEpisodes, parseEpisodeNumbers, parsePlayers, parseIframe } from "./doramasyt.js";
import { extractorFor } from "./extractors/index.js";
import { makeReq, UA } from "./util/http.js";
import { addArt, showArt, cachedArt } from "./art.js";

const RESOLVE_MS = 40000;
const MAX_COPIES = 6;
const CACHE_MS = 10 * 60 * 1000;

// ---- i18n ----

const STRINGS = {
  es: {
    onAir: "En emisión", dramas: "Doramas", movies: "Películas", news: "Novedades", genres: "Géneros", newEpisodes: "Capítulos nuevos", more: "Más doramas", moreMovies: "Más películas", episodeShort: "Cap.",
    heroText: "Doramas en español, con capítulos nuevos cada semana.", statusLine: "Carátulas guardadas: {n}", cacheCleared: "Caché vaciada.",
    lat: "Latino", esp: "Castellano", sub: "Subtitulado", episode: "Capítulo",
    unavailable: "El servicio no está disponible en este momento.",
    noEpisodes: "No se encontraron capítulos de este dorama.",
    noStreams: "Ningún servidor de este capítulo abrió. Prueba más tarde.",
    heroOnAir: "Doramas en emisión, con capítulos nuevos cada semana.",
  },
  en: {
    onAir: "On air", dramas: "Dramas", movies: "Movies", news: "What's new", genres: "Genres", newEpisodes: "New episodes", more: "More dramas", moreMovies: "More movies", episodeShort: "Ep.",
    heroText: "Dramas in Spanish, with new episodes every week.", statusLine: "Covers kept: {n}", cacheCleared: "Cache cleared.",
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

function toItem(card, kind, genreName) {
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
  if (genreName) item.genres = [genreName];
  return item;
}

const LISTINGS = {
  emision: { path: "/emision", titleKey: "onAir", kind: "series" },
  doramas: { path: "/doramas", titleKey: "dramas", kind: "series" },
  peliculas: { path: "/doramas?categoria=pelicula", titleKey: "movies", kind: "movie" },
};

/** `{ path, titleKey, kind }` for a browse ref: "list:<name>" or "genre:<slug>"; null for anything else. */
function listingOf(ref) {
  const m = /^(list|genre):([a-z0-9-]+)$/.exec(String(ref || ""));
  if (!m) return null;
  if (m[1] === "list") return LISTINGS[m[2]] ? { ...LISTINGS[m[2]], name: m[2] } : null;
  const g = GENRES.find((x) => x.slug === m[2]);
  return g ? { path: "/genero/" + g.slug, title: g.title, kind: "series", name: "genre-" + g.slug } : null;
}

/** What the person chose in Ajustes ▸ DoramasYT to show: everything, only what is dubbed (Latino, Castellano) or only what is subtitled. */
function audioChoice() {
  try { const v = kino.config.get("audio"); return v === "dub" || v === "sub" ? v : "all"; } catch (_) { return "all"; }
}
const byAudio = (cards) => {
  const a = audioChoice();
  if (a === "all") return cards;
  return cards.filter((c) => (langOf(c.title) !== "sub") === (a === "dub"));
};

async function listing(def, page) {
  const url = SITE + def.path + (page > 1 ? (def.path.includes("?") ? "&" : "?") + "page=" + page : "");
  return cached(`${def.name}:${page}`, async () => parseCards(await getPage(url)));
}

/** A Home or section row: the first page of a listing, art on its first cards, a "Ver más" ref. */
async function rowOf(id, def, ref) {
  const cards = byAudio(await listing(def, 1));
  const items = cards.slice(0, 20).map((c) => toItem(c, def.kind, def.title));
  return items.length ? { id, title: def.title || t(def.titleKey), items, ref, genre: def.kind === "movie" ? "peliculas" : "doramas" } : null;
}

/** The "Capítulos actualizados" cards of the home page, as shows with their newest episode; null when fewer than three shows (a bulk upload of one show is not news). */
async function newEpisodesRow() {
  const cards = await cached("latest", async () => parseLatestEpisodes(await getPage(SITE + "/")));
  const shown = byAudio(cards.map((c) => ({ ...c })));
  const items = shown.slice(0, 20).map((c) => { const it = toItem(c, "series"); it.badges = [`${t("episodeShort")} ${c.episode}`, ...(it.badges || [])]; return it; });
  return items.length >= 3 ? { id: "nuevos", title: t("newEpisodes"), items, genre: "doramas" } : null;
}

const safeRow = async (id, fn) => { try { return await fn(); } catch (e) { kino.log("row " + id + ": " + (e && e.message)); return null; } };

/** TMDB art over the cards of the rows, spread so each row gets its first cards (see art.js). */
async function withArt(rows) {
  const order = [];
  for (let i = 0; i < 20; i++) for (const row of rows) if (row.items[i]) order.push(row.items[i]);
  await addArt(order);
  return rows;
}

// ---- exports ----

export async function home() {
  const rows = (await Promise.all([
    safeRow("nuevos", newEpisodesRow),
    ...Object.keys(LISTINGS).map((name) => safeRow(name, () => rowOf(name, listingOf("list:" + name), "list:" + name))),
  ])).filter(Boolean);
  return withArt(rows);
}

export async function browse(ref, cursor) {
  const def = listingOf(ref);
  if (!def) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const cards = await listing(def, page);
  const items = byAudio(cards).map((c) => toItem(c, def.kind));
  await addArt(items);
  return { items, next: cards.length >= 24 ? String(page + 1) : undefined };
}

export async function search(arg) {
  const q = String(typeof arg === "string" ? arg : (arg && arg.q) || "").trim();
  if (q.length < 2) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${SITE}/buscar?q=${encodeURIComponent(q)}`)));
  return addArt(byAudio(cards).slice(0, 40).map((c) => toItem(c, "series")));
}

// ---- the plugin's own section, categories and details ----

const SECTION_TABS = () => [
  { id: "novedades", label: t("news") },
  { id: "doramas", label: t("dramas") },
  { id: "peliculas", label: t("movies") },
  { id: "generos", label: t("genres") },
];

/** The hero of a section: the first show that has TMDB art (background and synopsis), else the first show with the plain line. */
function heroOf(rows) {
  const first = rows.flatMap((r) => r.items)[0];
  if (!first) return undefined;
  const art = cachedArt(first.title) || {};
  const hero = { title: first.title, text: String(art.overview || t("heroText")).slice(0, 300) };
  if (art.backdrop) hero.image = art.backdrop;
  return hero;
}

export async function section({ tab } = {}) {
  const tabs = SECTION_TABS();
  const chosen = tabs.some((x) => x.id === tab) ? tab : "novedades";
  let rows = [];
  if (chosen === "novedades") {
    rows = [await safeRow("nuevos", newEpisodesRow), await safeRow("emision", () => rowOf("emision", listingOf("list:emision"), "list:emision"))];
  } else if (chosen === "doramas") {
    const d = listingOf("list:doramas");
    rows = [await safeRow("doramas", () => rowOf("doramas", d, "list:doramas")), await safeRow("doramas2", async () => {
      const items = byAudio(await listing(d, 2)).map((c) => toItem(c, "series"));
      return items.length ? { id: "doramas2", title: t("more"), items, genre: "doramas" } : null;
    })];
  } else if (chosen === "peliculas") {
    const d = listingOf("list:peliculas");
    rows = [await safeRow("peliculas", () => rowOf("peliculas", d, "list:peliculas")), await safeRow("peliculas2", async () => {
      const items = byAudio(await listing(d, 2)).map((c) => toItem(c, "movie"));
      return items.length ? { id: "peliculas2", title: t("moreMovies"), items, genre: "peliculas" } : null;
    })];
  } else {
    rows = await Promise.all(GENRES.slice(0, 6).map((g) => safeRow("genre-" + g.slug, () => rowOf("genre-" + g.slug, listingOf("genre:" + g.slug), "genre:" + g.slug))));
  }
  rows = await withArt(rows.filter(Boolean));
  const answer = { tabs, tab: chosen, rows };
  const hero = heroOf(rows);
  if (hero) answer.hero = hero;
  return answer;
}

export async function categories() {
  return GENRES.map((g) => ({ id: "g-" + g.slug, title: g.title, ref: "genre:" + g.slug }));
}

/** A movie's own page: its synopsis, genres, year and length from the site, the background and score from TMDB. */
export async function details(ref) {
  const m = /^[dm]:([a-z0-9-]+)$/i.exec(String(ref || ""));
  if (!m) return null;
  const html = await getPage(`${SITE}/dorama/${m[1]}`);
  const show = parseShow(html);
  const facts = parseFacts(html);
  const name = show.title.replace(/\s+(latino|castellano)$/i, "").trim() || show.title;
  const art = await showArt(name);
  const out = { overview: show.overview || art.overview, genres: show.genres.length ? show.genres : undefined, year: facts.year || art.year, runtimeMinutes: facts.minutes, rating: art.rating, backdrop: art.backdrop || show.backdrop, poster: art.poster || show.poster };
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === "") delete out[k];
  return out;
}

// ---- Ajustes ▸ DoramasYT ----

export async function settingsStatus() {
  let n = 0;
  try { n = kino.storage.keys().filter((k) => k.startsWith("art2:")).length; } catch (_) { /* no storage */ }
  return { info: t("statusLine").replace("{n}", String(n)) };
}

export async function action(key) {
  if (key === "clearCache") {
    try { for (const k of kino.storage.keys()) if (k.startsWith("art2:") || k.startsWith("c:")) kino.storage.remove(k); } catch (_) { /* nothing to clear */ }
    return { message: t("cacheCleared") };
  }
  return { message: "" };
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
