// node --test test/plugin.test.mjs
// Offline: a fake www.doramasyt.com (listings, a show, its caplist, an episode page, /reproductor), real fragments of the four
// players' pages (test/fixtures) and a stub of `kino`.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateManifest } from "../sdk/contract.mjs";

const fixture = (n) => readFileSync(new URL("./fixtures/" + n, import.meta.url), "utf8");
const calls = [];
let pages = {};
let logs = [];
let store = new Map();
let lang = "es";
let cfg = {};
const reply = (p) => {
  const status = p?.status ?? (p ? 200 : 404);
  const body = typeof p === "function" ? "" : (p?.body ?? "");
  return { ok: status < 400, status, url: "", text: () => body, json: () => JSON.parse(body) };
};
globalThis.kino = {
  get lang() { return lang; },
  config: { get: (k) => cfg[k] },
  fetch: async (url, opts = {}) => {
    calls.push({ url, opts });
    const p = pages[url];
    return reply(typeof p === "function" ? p(opts) : p);
  },
  storage: { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, String(v)), keys: () => [...store.keys()], remove: (k) => store.delete(k) },
  log: (...a) => logs.push(a.join(" ")),
  error: (code, message, opts = {}) => Object.assign(new Error(message), { code, ...opts }),
};
const plugin = await import("../plugin.js");
const art = await import("../src/art.js");
const { addressOf } = await import("../src/extractors/streamtape.js");
const { extractorFor } = await import("../src/extractors/index.js");
const { makeReq } = await import("../src/util/http.js");

beforeEach(() => { calls.length = 0; pages = {}; logs = []; store = new Map(); lang = "es"; cfg = {}; });

const S = "https://www.doramasyt.com";
const card = (slug, title, img = "https://www.doramasyt.com/thumbs/x.webp") => `<li class="col mb-3"><article><a href="${S}/dorama/${slug}"><div><img class="lazy" src="${S}/img/capblank.png" data-src="${img}"></div><h3 class="h6">${title}</h3></a></article></li>`;
const LISTING = `<ul>${card("secretaria-kim-latino-sub-espanol", "Qué le ocurre a la secretaria Kim Latino")}${card("moon-lovers-sub-espanol", "Moon Lovers")}${card("moon-lovers-sub-espanol", "Moon Lovers (dup)")}<li class="col"><article><a href="${S}/ver/x-episodio-1"><h3>An episode card</h3></a></article></li></ul>`;

const SHOW = `<html><head><meta name="csrf-token" content="TOK123"></head><body>
<img class="rounded-3 w-100" data-src="${S}/thumbs/imagen/p.webp"><img class="w-100 h-100" data-src="${S}/thumbs/fondo/b.webp">
<h1 class="fs-2 fw-bold">Qué le ocurre a la secretaria Kim Latino</h1><div class="mb-3">Una sinopsis larga. Ver menos</div>
<div class=" my-4"><div class="lh-lg"><small>Géneros</small> <a href="${S}/genero/romance"><span class="badge">Romance</span></a> <a href="${S}/genero/drama"><span class="badge">Drama</span></a></div></div>
<div class="caplist" data-ajax="${S}/ajax/ajax_pagination/2275"></div></body></html>`;
const CAPLIST = JSON.stringify({ paginate_url: S + "/ajax/caplist/2275", perpage: 50, eps: [{ num: 3 }, { num: 1 }, { num: 2 }, { num: 2 }] });

const btn = (name, value) => `<li id="play-video" class="nav-item"><button class="play-video fs-6 nav-link" data-player="${value}"> ${name} </button></li>`;
const EPISODE = `<ul id="myTab">${btn("mega", "ENC-MEGA")}${btn("voe", "ENC-VOE")}${btn("mp4upload", "ENC-MP4")}${btn("lulu", "ENC-LULU")}${btn("streamtape", "ENC-ST")}${btn("mxdrop", "ENC-MX")}${btn("filemoon", "ENC-FM")}</ul>`;
const frame = (src) => ({ body: `<html><body><iframe src="${src}" allowfullscreen></iframe></body></html>` });

const slug = "secretaria-kim-latino-sub-espanol";
const installEpisode = (n = 1) => {
  pages[`${S}/ver/secretaria-kim-latino-episodio-${n}`] = { body: EPISODE };
  pages[`${S}/reproductor?video=ENC-MP4`] = frame("https://www.mp4upload.com/embed-abc.html");
  pages[`${S}/reproductor?video=ENC-LULU`] = frame("https://luluvdo.com/e/xyz");
  pages[`${S}/reproductor?video=ENC-ST`] = frame("https://streamtape.com/e/abc/file.mp4");
  pages[`${S}/reproductor?video=ENC-MX`] = frame("https://mixdrop.top/e/abc");
  pages["https://www.mp4upload.com/embed-abc.html"] = { body: fixture("mp4upload.html") };
  pages["https://luluvdo.com/e/xyz"] = { body: fixture("luluvdo.html") };
  pages["https://streamtape.com/e/abc/file.mp4"] = { body: fixture("streamtape.html") };
  pages["https://mixdrop.top/e/abc"] = { body: fixture("mixdrop.html") };
};

test("the manifest passes the kit's contract check and declares the site and every player host", async () => {
  const text = readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8");
  const m = JSON.parse(text);
  const v = validateManifest(text);
  assert.ok(!v.errors?.length && v.ok !== false, JSON.stringify(v));
  const { HOSTS } = await import("../src/extractors/index.js");
  for (const h of ["www.doramasyt.com", "doramasyt.com", ...HOSTS]) assert.ok(m.hosts.includes(h), h);
  assert.ok(m.hosts.includes("www.mp4upload.com"));
});

test("home: three rows from the listings, cards deduplicated, a non-show card left out, Latino marked", async () => {
  for (const p of ["/emision", "/doramas", "/doramas?categoria=pelicula"]) pages[S + p] = { body: LISTING };
  const rows = await plugin.home();
  assert.deepEqual(rows.map((r) => r.id), ["emision", "doramas", "peliculas"]);
  assert.deepEqual(rows[0].items.map((i) => i.ref), ["d:secretaria-kim-latino-sub-espanol", "d:moon-lovers-sub-espanol"]);
  assert.equal(rows[0].items[0].title, "Qué le ocurre a la secretaria Kim", "the Latino tag leaves the title");
  assert.deepEqual(rows[0].items[0].badges, ["Latino"]);
  assert.equal(rows[0].items[1].badges[0], "Subtitulado");
  assert.equal(rows[2].items[0].kind, "movie");
  assert.equal(rows[2].items[0].ref, "m:secretaria-kim-latino-sub-espanol");
  assert.ok(rows[0].items[0].poster.startsWith("https://www.doramasyt.com/thumbs/"), "the placeholder image is never a poster");
});

test("browse pages by ?page=N and offers the next page only on a full page", async () => {
  const full = `<ul>${Array.from({ length: 24 }, (_, i) => card("show-" + i + "-sub-espanol", "Show " + i)).join("")}</ul>`;
  pages[S + "/doramas?page=2"] = { body: full };
  const p = await plugin.browse("list:doramas", "2");
  assert.equal(p.items.length, 24);
  assert.equal(p.next, "3");
  pages[S + "/emision"] = { body: LISTING };
  assert.equal((await plugin.browse("list:emision", null)).next, undefined);
  assert.deepEqual((await plugin.browse("nope", null)).items, []);
});

test("search: asks /buscar?q=, short queries ask nothing", async () => {
  pages[S + "/buscar?q=kim%20moon"] = { body: LISTING };
  assert.equal((await plugin.search("kim moon")).length, 2);
  assert.deepEqual(await plugin.search("k"), []);
  assert.equal(calls.length, 1);
  assert.equal((await plugin.search({ q: "kim moon" })).length, 2, "an object argument works too");
});

test("episodes: the show's details, then the caplist POST with the csrf token; numbers ascending and unique", async () => {
  pages[`${S}/dorama/${slug}`] = { body: SHOW };
  pages[`${S}/ajax/ajax_pagination/2275`] = (o) => ({ body: o.body?.form?._token === "TOK123" && o.method === "POST" ? CAPLIST : "{}" });
  const r = await plugin.episodes("d:" + slug);
  assert.deepEqual(r.episodes.map((e) => e.number), [1, 2, 3]);
  assert.equal(r.episodes[0].ref, `e:${slug}:1`);
  assert.equal(r.series.title, "Qué le ocurre a la secretaria Kim");
  assert.deepEqual(r.series.genres, ["Romance", "Drama"]);
  assert.equal(r.series.overview, "Una sinopsis larga.");
  assert.ok(r.series.poster.endsWith("/p.webp") && r.series.backdrop.endsWith("/b.webp"));
  const post = calls.find((c) => c.url.includes("ajax_pagination"));
  assert.equal(post.opts.headers["X-Requested-With"], "XMLHttpRequest");
});

test("episodes: a page with no caplist, or an empty one, is an error with a sentence for the person", async () => {
  pages[`${S}/dorama/${slug}`] = { body: "<html>nothing</html>" };
  await assert.rejects(plugin.episodes("d:" + slug), (e) => e.code === "not_found" && /capítulos/.test(e.userMessage));
  pages[`${S}/dorama/${slug}`] = { body: SHOW };
  pages[`${S}/ajax/ajax_pagination/2275`] = { body: JSON.stringify({ eps: [] }) };
  await assert.rejects(plugin.episodes("d:" + slug), (e) => e.code === "not_found");
  await assert.rejects(plugin.episodes("zz"), (e) => e.code === "not_found");
});

test("resolve: the best known server first (Mp4Upload), the other three as lazy copies, servers with no extractor left out", async () => {
  installEpisode();
  const s = await plugin.resolve(`e:${slug}:1`);
  assert.match(s.url, /^https:\/\/a\d+\.mp4upload\.com/);
  assert.equal(s.mime, "video/mp4");
  assert.equal(s.label, "Latino · Mp4Upload");
  assert.equal(s.headers.Referer, "https://www.mp4upload.com/");
  assert.deepEqual(s.alternatives.map((a) => a.label), ["Latino · LuluVdo", "Latino · StreamTape", "Latino · MixDrop"]);
  assert.deepEqual(s.alternatives.map((a) => a.ref), [`c:${slug}:1:1`, `c:${slug}:1:2`, `c:${slug}:1:3`]);
  assert.ok(!calls.some((c) => /ENC-(MEGA|VOE|FM)/.test(c.url)), "mega, voe and filemoon are never opened");
});

test("resolve: each lazy copy opens its own server, with the right file type and no further alternatives", async () => {
  installEpisode();
  const lulu = await plugin.resolve(`c:${slug}:1:1`);
  assert.equal(lulu.mime, "application/vnd.apple.mpegurl");
  assert.match(lulu.url, /master\.m3u8/);
  assert.equal(lulu.alternatives, undefined);
  const st = await plugin.resolve(`c:${slug}:1:2`);
  assert.match(st.url, /^https:\/\/streamtape\.com\/get_video\?id=.+token=/);
  assert.equal(st.label, "Latino · StreamTape");
  const mx = await plugin.resolve(`c:${slug}:1:3`);
  assert.match(mx.url, /^https:\/\/a-delivery\d+\.mxcontent\.net\/v2\/.+\.mp4\?/);
});

test("resolve: a server that fails falls through to the next one; all failing is a sentence for the person", async () => {
  installEpisode();
  pages["https://www.mp4upload.com/embed-abc.html"] = { body: "<html>gone</html>" };
  const s = await plugin.resolve(`e:${slug}:1`);
  assert.equal(s.label, "Latino · LuluVdo");
  assert.deepEqual(s.alternatives.map((a) => a.ref), [`c:${slug}:1:0`, `c:${slug}:1:2`, `c:${slug}:1:3`]);
  for (const u of ["https://luluvdo.com/e/xyz", "https://streamtape.com/e/abc/file.mp4", "https://mixdrop.top/e/abc"]) pages[u] = { status: 503, body: "" };
  await assert.rejects(plugin.resolve(`e:${slug}:1`), (e) => e.code === "not_found" && /Ningún servidor/.test(e.userMessage));
});

test("resolve: a movie is the site's episode 0, and episode 1 of a movie lands there too", async () => {
  const mslug = "apple-of-my-eye-sub-espanol";
  pages[`${S}/ver/apple-of-my-eye-episodio-0`] = { body: EPISODE };
  pages[`${S}/reproductor?video=ENC-MP4`] = frame("https://www.mp4upload.com/embed-abc.html");
  pages["https://www.mp4upload.com/embed-abc.html"] = { body: fixture("mp4upload.html") };
  const a = await plugin.resolve(`m:${mslug}`);
  assert.equal(a.label, "Subtitulado · Mp4Upload");
  calls.length = 0;
  const b = await plugin.resolve(`e:${mslug}:1`);
  assert.equal(b.label, "Subtitulado · Mp4Upload");
  assert.deepEqual(calls.slice(0, 2).map((c) => c.url.replace(S, "")), ["/ver/apple-of-my-eye-episodio-1", "/ver/apple-of-my-eye-episodio-0"]);
});

test("resolve: refs that are not ours or an episode page that is gone are errors, not crashes", async () => {
  await assert.rejects(plugin.resolve("x:1"), (e) => e.code === "not_found");
  await assert.rejects(plugin.resolve(`c:${slug}:1:9`), (e) => e.code === "not_found" || e.code === "unavailable");
  await assert.rejects(plugin.resolve(`e:${slug}:7`), (e) => e.code === "unavailable");
});

// ---- extractors, on real fragments of the players' pages ----

const reqFor = () => makeReq(globalThis.kino, { deadline: Date.now() + 20000 });

test("streamtape: the decoy lines are ignored and the address the `robotlink` line spells is the one used", () => {
  const url = addressOf(fixture("streamtape.html"));
  assert.match(url, /^https:\/\/streamtape\.com\/get_video\?id=[\w]+&expires=\d+&ip=[\w]+&token=[\w-]+$/);
  assert.equal(addressOf("<html>nothing</html>"), null);
  const synthetic = `document.getElementById('robotlink').innerHTML = '//strea'+ ('xyzamtape.com/get_video?id=A&expires=1&ip=B&token=C').substring(4);`;
  assert.equal(addressOf(synthetic), "https://streamtape.com/get_video?id=A&expires=1&ip=B&token=C");
});

test("extractorFor: the four hosts and their mirrors, nothing else", () => {
  for (const [u, n] of [["https://www.mp4upload.com/embed-x.html", "mp4upload"], ["https://luluvdo.com/e/x", "luluvdo"], ["https://mixdrop.top/e/x", "mixdrop"], ["https://mxdrop.click/e/x", "mixdrop"], ["https://streamtape.com/e/x", "streamtape"], ["https://strtape.cloud/e/x", "streamtape"]]) assert.equal(extractorFor(u)?.name, n, u);
  for (const u of ["https://voe.sx/e/x", "https://filemoon.sx/e/x", "https://mega.nz/embed/x", "not a url"]) assert.equal(extractorFor(u), null, u);
});

test("mixdrop and luluvdo: the packed script gives the file; a page without it gives nothing", async () => {
  pages["https://mixdrop.top/e/a"] = { body: fixture("mixdrop.html") };
  pages["https://luluvdo.com/e/b"] = { body: fixture("luluvdo.html") };
  pages["https://mixdrop.top/e/c"] = { body: "<html>deleted</html>" };
  const mx = await extractorFor("https://mixdrop.top/e/a").extract("https://mixdrop.top/e/a", reqFor(), kino);
  assert.match(mx.url, /^https:\/\/a-delivery\d+\.mxcontent\.net\/v2\//);
  assert.equal(mx.headers.Referer, "https://mixdrop.top/");
  const lu = await extractorFor("https://luluvdo.com/e/b").extract("https://luluvdo.com/e/b", reqFor(), kino);
  assert.match(lu.url, /^https:\/\/[^/]+\/hls2\/.+master\.m3u8/);
  assert.equal(await extractorFor("https://mixdrop.top/e/c").extract("https://mixdrop.top/e/c", reqFor(), kino), null);
  assert.ok(logs.some((l) => /mixdrop/.test(l) && /no file/.test(l)));
});

// ---- cover art from TMDB (the site's own images are blocked for Kino's image loader) ----

const tmdbCalls = [];
let tmdbImpl = null;
const withTmdb = (impl) => { tmdbImpl = impl; globalThis.kino.tmdb = async (path, params) => { tmdbCalls.push({ path, params }); return tmdbImpl(path, params); }; globalThis.kino.sleep = async () => {}; };
const noTmdb = () => { delete globalThis.kino.tmdb; delete globalThis.kino.sleep; tmdbImpl = null; };
beforeEach(() => { tmdbCalls.length = 0; noTmdb(); });
const hit = (name, extra = {}) => ({ results: [{ media_type: "tv", name, original_name: name, poster_path: "/p.jpg", backdrop_path: "/b.jpg", first_air_date: "2024-03-01", vote_average: 8.34, original_language: "ko", ...extra }] });

test("art: an exact name, a name that contains the other, or the top Asian-language hit; never a poster-less or unrelated result", () => {
  const r = (name, o = {}) => ({ media_type: "tv", name, original_name: "x", poster_path: "/p.jpg", original_language: "en", ...o });
  assert.equal(art.pickResult([r("Other"), r("Moon Lovers")], "Moon Lovers (Latino)").name, "Moon Lovers");
  assert.equal(art.pickResult([r("Moon Lovers: Scarlet Heart Ryeo")], "Moon Lovers").name, "Moon Lovers: Scarlet Heart Ryeo");
  assert.equal(art.pickResult([r("La corona perfecta", { original_language: "ko" })], "Perfect Crown").name, "La corona perfecta", "the Spanish name of the right Korean show");
  assert.equal(art.pickResult([r("Perfect Crown", { poster_path: null })], "Perfect Crown"), null, "no poster, no result");
  assert.equal(art.pickResult([r("Something Else")], "Perfect Crown"), null, "an English show with another name is not it");
  assert.equal(art.pickResult([], "x"), null);
  const twin = [r("What's Wrong with Secretary Kim?", { original_language: "tl", id: 2024 }), r("What's Wrong with Secretary Kim?", { original_language: "ko", id: 2018 })];
  assert.equal(art.pickResult(twin, "What's Wrong with Secretary Kim?").id, 2018, "two shows with one name: the Korean one, not its Philippine remake");
  assert.equal(art.pickResult([r("The Office", { original_language: "en", id: 1 })], "The Office").id, 1, "with no Asian hit nearby an exact name still wins");
  assert.equal(art.pickResult([r("Another Show", { original_language: "ko", id: 5 }), r("Other", { original_language: "ko", id: 6 })], "Perfect Crown", { loose: false }), null, "strict: a top Asian hit with another name is not taken");
  assert.equal(art.norm("Qué le ocurre a la Secretaria Kim Latino"), "que le ocurre a la secretaria kim");
});

test("art: a listing gets TMDB posters, year and rating; the answer is kept, so the next call asks nothing", async () => {
  withTmdb((path, params) => hit(params.query));
  pages[S + "/doramas?page=2"] = { body: LISTING };
  const first = await plugin.browse("list:doramas", "2");
  assert.equal(first.items[0].poster, "https://image.tmdb.org/t/p/w500/p.jpg");
  assert.equal(first.items[0].year, "2024");
  assert.equal(first.items[0].rating, 8.3);
  assert.equal(tmdbCalls.length, 2);
  assert.equal(tmdbCalls[0].path, "/search/multi");
  assert.equal(tmdbCalls[0].params.language, "es-MX");
  const again = await plugin.browse("list:doramas", "2");
  assert.equal(again.items[0].poster, first.items[0].poster);
  assert.equal(tmdbCalls.length, 2, "cached");
});

test("art: a title TMDB does not know keeps its place and is not asked again; a Kino with no kino.tmdb shows the list as it is", async () => {
  withTmdb(() => ({ results: [] }));
  pages[S + "/emision"] = { body: LISTING };
  const a = await plugin.browse("list:emision", null);
  assert.equal(a.items.length, 2);
  assert.ok(a.items[0].poster.includes("doramasyt.com"), "the site's poster stays as the last resort");
  const n = tmdbCalls.length;
  await plugin.browse("list:emision", null);
  assert.equal(tmdbCalls.length, n, "a miss is cached too");
  noTmdb(); store = new Map();
  assert.equal((await plugin.browse("list:emision", null)).items.length, 2);
});

test("art: when Kino's TMDB limit is spent the list still comes, with the art it got", async () => {
  let n = 0;
  withTmdb((path, params) => { if (++n > 2) throw Object.assign(new Error("slow down"), { code: "rate_limited" }); return hit(params.query); });
  const full = `<ul>${Array.from({ length: 24 }, (_, i) => card("show-" + i + "-sub-espanol", "Show " + i)).join("")}</ul>`;
  pages[S + "/doramas"] = { body: full };
  const p = await plugin.browse("list:doramas", null);
  assert.equal(p.items.length, 24);
  assert.equal(p.items.filter((i) => i.poster.includes("image.tmdb.org")).length, 2);
  assert.ok(logs.some((l) => /art: stopped.*rate_limited/.test(l)));
});

test("art: no more than 24 lookups per call, the rest wait for the next one", async () => {
  withTmdb((path, params) => hit(params.query));
  const many = (prefix) => `<ul>${Array.from({ length: 30 }, (_, i) => card(`${prefix}-${i}-sub-espanol`, `${prefix} ${i}`)).join("")}</ul>`;
  pages[S + "/buscar?q=more"] = { body: many("more") };
  const first = await plugin.search("more");
  assert.equal(tmdbCalls.length, 24);
  assert.equal(first.filter((i) => i.poster.includes("image.tmdb.org")).length, 24);
  tmdbCalls.length = 0;
  const second = await plugin.search("more");
  assert.equal(tmdbCalls.length, 6, "the next call asks only for what is still missing");
  assert.equal(second.filter((i) => i.poster.includes("image.tmdb.org")).length, 30);
});

test("art: a show's page uses TMDB's poster and background over the site's blocked ones, and TMDB's synopsis only when the site has none", async () => {
  withTmdb((path, params) => hit(params.query, { overview: "TMDB synopsis" }));
  pages[`${S}/dorama/${slug}`] = { body: SHOW };
  pages[`${S}/ajax/ajax_pagination/2275`] = { body: CAPLIST };
  const r = await plugin.episodes("d:" + slug);
  assert.equal(r.series.poster, "https://image.tmdb.org/t/p/w500/p.jpg");
  assert.equal(r.series.backdrop, "https://image.tmdb.org/t/p/w780/b.jpg");
  assert.equal(r.series.overview, "Una sinopsis larga.", "the site's synopsis is in Spanish and stays");
  assert.equal(r.series.year, "2024");
  assert.equal(tmdbCalls[0].params.query, "Qué le ocurre a la secretaria Kim");
});

test("art: an English title whose Korean original TMDB names in Spanish is found by the English search, not confused with a remake", async () => {
  const kr = { media_type: "tv", name: "¿Qué le ocurre a la secretaria Kim?", original_name: "김비서가 왜 그럴까", original_language: "ko", poster_path: "/kr.jpg", first_air_date: "2018-06-06", id: 2018 };
  const krEn = { ...kr, name: "What's Wrong with Secretary Kim", id: 2018 };
  const ph = { media_type: "tv", name: "What's Wrong with Secretary Kim?", original_name: "What's Wrong with Secretary Kim?", original_language: "tl", poster_path: "/ph.jpg", first_air_date: "2024-08-01", id: 2024 };
  const film = { media_type: "movie", title: "김비서는 정말 왜 그럴까?", original_title: "김비서는 정말 왜 그럴까?", original_language: "ko", poster_path: "/film.jpg", release_date: "2020-01-01", id: 7 };
  withTmdb((path, params) => ({ results: params.language === "en-US" ? [ph, krEn] : [ph, film, kr] }));
  pages[S + "/buscar?q=secretary%20kim"] = { body: `<ul>${card("whats-wrong-with-secretary-kim-sub-espanol", "What's Wrong with Secretary Kim?")}</ul>` };
  const [item] = await plugin.search("secretary kim");
  assert.equal(item.poster, "https://image.tmdb.org/t/p/w500/kr.jpg");
  assert.equal(item.year, "2018");
  assert.deepEqual(tmdbCalls.map((c) => c.params.language), ["es-MX", "en-US"]);
});

test("art: a Spanish title found at once as an Asian original costs one call", async () => {
  withTmdb((path, params) => hit(params.query, { name: params.query }));
  pages[S + "/doramas"] = { body: `<ul>${card("x-sub-espanol", "Mi Dorama")}</ul>` };
  await plugin.browse("list:doramas", null);
  assert.equal(tmdbCalls.length, 1);
});

// ---- the plugin's own section, categories, details and settings ----

const LATEST = (n) => `<ul>${Array.from({ length: n }, (_, i) => `<li class="col"><article><a href="${S}/ver/show-${i}-latino-episodio-${10 + i}"><img data-src="${S}/thumbs/e${i}.webp"><h3>Ver Show ${i} Latino Capítulo ${10 + i}</h3></a></article></li>`).join("")}</ul>`;
const installLists = () => {
  for (const p of ["/emision", "/doramas", "/doramas?categoria=pelicula", "/doramas?page=2", "/doramas?categoria=pelicula&page=2"]) pages[S + p] = { body: LISTING };
  pages[S + "/"] = { body: LATEST(2) };
};

test("home: the new-episodes row appears only when at least three shows have one; one row per listing besides", async () => {
  installLists();
  assert.deepEqual((await plugin.home()).map((r) => r.id), ["emision", "doramas", "peliculas"]);
  store = new Map();
  pages[S + "/"] = { body: LATEST(4) };
  const rows = await plugin.home();
  assert.deepEqual(rows.map((r) => r.id), ["nuevos", "emision", "doramas", "peliculas"]);
  assert.equal(rows[0].title, "Capítulos nuevos");
  assert.equal(rows[0].items[0].ref, "d:show-0-latino-sub-espanol");
  assert.ok(rows[0].items[0].badges.includes("Cap. 10") && rows[0].items[0].badges.includes("Latino"));
  assert.equal(rows[0].ref, undefined, "a row of cards from one page has no Ver más");
});

test("section: four tabs, an unknown tab is the first one, every row has items, the hero names the first title and borrows its TMDB art", async () => {
  installLists();
  withTmdb((path, params) => hit(params.query, { overview: "Una historia de ejemplo", backdrop_path: "/fondo.jpg" }));
  const first = await plugin.section({ tab: null });
  assert.deepEqual(first.tabs.map((x) => x.id), ["novedades", "doramas", "peliculas", "generos"]);
  assert.equal(first.tab, "novedades");
  assert.equal((await plugin.section({ tab: "nope" })).tab, "novedades");
  assert.ok(first.rows.length >= 1 && first.rows.every((r) => r.items.length));
  assert.equal(first.hero.title, first.rows[0].items[0].title);
  assert.equal(first.hero.image, "https://image.tmdb.org/t/p/w780/fondo.jpg");
  assert.equal(first.hero.text, "Una historia de ejemplo");
  const dramas = await plugin.section({ tab: "doramas" });
  assert.deepEqual(dramas.rows.map((r) => r.title), ["Doramas", "Más doramas"]);
  assert.equal(dramas.rows[0].ref, "list:doramas");
  assert.equal((await plugin.section({ tab: "peliculas" })).rows[0].items[0].kind, "movie");
});

test("section: the genres tab has a row per genre with its own Ver más, and a hero with no art still has a line of text", async () => {
  noTmdb();
  for (const g of ["k-drama", "j-drama", "c-drama", "thai-drama", "romance", "comedia"]) pages[`${S}/genero/${g}`] = { body: LISTING };
  const r = await plugin.section({ tab: "generos" });
  assert.deepEqual(r.rows.map((x) => x.ref), ["genre:k-drama", "genre:j-drama", "genre:c-drama", "genre:thai-drama", "genre:romance", "genre:comedia"]);
  assert.equal(r.rows[0].title, "K-Drama");
  assert.match(r.hero.text, /Doramas en español/);
  assert.equal(r.hero.image, undefined);
});

test("categories: the twelve genres of the site, each opening its own paged list", async () => {
  const c = await plugin.categories();
  assert.equal(c.length, 12);
  assert.equal(c[0].ref, "genre:k-drama");
  assert.ok(c.every((x) => x.title && x.title.length <= 40 && /^g-[a-z-]+$/.test(x.id)));
  pages[`${S}/genero/romance?page=2`] = { body: LISTING };
  assert.equal((await plugin.browse("genre:romance", "2")).items.length, 2);
  assert.deepEqual((await plugin.browse("genre:unknown", null)).items, []);
});

test("details: a show's synopsis, genres, year and length from its page, the background and score from TMDB", async () => {
  withTmdb((path, params) => hit(params.query, { vote_average: 7.77 }));
  pages[`${S}/dorama/${slug}`] = { body: SHOW.replace("</body>", '<dl><dt>Tipo:</dt><dd>Pelicula</dd><dt>Fecha de emisión:</dt><dd>21 de Febrero de 2025</dd><dt>Duración:</dt><dd>1 h 26 min</dd></dl></body>') };
  const d = await plugin.details("m:" + slug);
  assert.equal(d.overview, "Una sinopsis larga.");
  assert.deepEqual(d.genres, ["Romance", "Drama"]);
  assert.equal(d.year, "2025");
  assert.equal(d.runtimeMinutes, 86);
  assert.equal(d.rating, 7.8);
  assert.equal(d.backdrop, "https://image.tmdb.org/t/p/w780/b.jpg");
  assert.equal(await plugin.details("zz"), null);
});

test("settings: only dubbed or only subtitled narrows lists and search; the status line counts the covers kept; the action clears them", async () => {
  installLists();
  pages[S + "/buscar?q=kim"] = { body: LISTING };
  const names = async () => (await plugin.search("kim")).map((i) => i.ref);
  assert.equal((await names()).length, 2);
  cfg.audio = "dub";
  assert.deepEqual(await names(), ["d:secretaria-kim-latino-sub-espanol"]);
  cfg.audio = "sub";
  assert.deepEqual(await names(), ["d:moon-lovers-sub-espanol"]);
  cfg.audio = "all";
  withTmdb((path, params) => hit(params.query));
  await plugin.search("kim");
  assert.match((await plugin.settingsStatus()).info, /Carátulas guardadas: 2/);
  lang = "en";
  assert.match((await plugin.settingsStatus()).info, /Covers kept: 2/);
  lang = "es";
  assert.equal((await plugin.action("clearCache")).message, "Caché vaciada.");
  assert.match((await plugin.settingsStatus()).info, /guardadas: 0/);
  assert.equal(store.size, 0);
});

test("settings: with the covers switched off no lookup is made and the lists still come", async () => {
  withTmdb((path, params) => hit(params.query));
  cfg.covers = false;
  pages[S + "/emision"] = { body: LISTING };
  const p = await plugin.browse("list:emision", null);
  assert.equal(p.items.length, 2);
  assert.equal(tmdbCalls.length, 0);
});
