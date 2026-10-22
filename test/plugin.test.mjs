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
const reply = (p) => {
  const status = p?.status ?? (p ? 200 : 404);
  const body = typeof p === "function" ? "" : (p?.body ?? "");
  return { ok: status < 400, status, url: "", text: () => body, json: () => JSON.parse(body) };
};
globalThis.kino = {
  get lang() { return lang; },
  config: { get: () => undefined },
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
const { addressOf } = await import("../src/extractors/streamtape.js");
const { extractorFor } = await import("../src/extractors/index.js");
const { makeReq } = await import("../src/util/http.js");

beforeEach(() => { calls.length = 0; pages = {}; logs = []; store = new Map(); lang = "es"; });

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
