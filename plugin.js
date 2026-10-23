var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/doramasyt.js
var SITE = "https://www.doramasyt.com";
var decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).trim();
var strip = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
var slugOf = (href) => (/\/dorama\/([a-z0-9-]+)\/?(?:[?#].*)?$/i.exec(String(href || "")) || [])[1] || null;
var baseOf = (slug) => String(slug || "").replace(/-sub-espanol$/, "");
var watchUrl = (slug, n) => `${SITE}/ver/${baseOf(slug)}-episodio-${Number(n)}`;
var langOf = (text2) => /\blatino\b/i.test(text2) ? "lat" : /\bcastellano\b/i.test(text2) ? "esp" : "sub";
function parseCards(html) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const m of String(html || "").matchAll(/<li\b[^>]*class="[^"]*\bcol\b[^"]*"[^>]*>([\s\S]*?)<\/li>/g)) {
    const slug = slugOf((/<a\b[^>]*\bhref="([^"]+)"/.exec(m[1]) || [])[1]);
    const title = strip((/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(m[1]) || [])[1]);
    if (!slug || !title || seen.has(slug)) continue;
    const img = (/<img\b[^>]*\bdata-src="([^"]+)"/.exec(m[1]) || /<img\b[^>]*\bsrc="([^"]+)"/.exec(m[1]) || [])[1];
    seen.add(slug);
    out.push({ slug, title, poster: img && !/capblank/.test(img) ? new URL(decode(img), SITE + "/").href : void 0 });
  }
  return out;
}
function parseShow(html) {
  const s = String(html || "");
  const grab = (re) => strip((re.exec(s) || [])[1]);
  const imgs = [...s.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]).map((tag) => ({ cls: (/\bclass="([^"]*)"/.exec(tag) || [])[1] || "", src: (/\bdata-src="([^"]+)"/.exec(tag) || /\bsrc="([^"]+)"/.exec(tag) || [])[1] }));
  const poster = (imgs.find((i) => /\brounded-3\b/.test(i.cls) && i.src) || {}).src;
  const backdrop = (imgs.find((i) => /\bw-100\b/.test(i.cls) && !/\brounded-3\b/.test(i.cls) && i.src && !/capblank/.test(i.src)) || {}).src;
  const abs = (u) => u && !/capblank/.test(u) ? new URL(decode(u), SITE + "/").href : void 0;
  const genres = [...s.matchAll(/<a\b[^>]*\bhref="[^"]*\/genero\/[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/g)].map((m) => decode(m[1])).filter(Boolean);
  return {
    title: grab(/class="[^"]*\bfs-2\b[^"]*"[^>]*>([\s\S]*?)<\//),
    overview: grab(/<div class="[^"]*\bmb-3\b[^"]*"[^>]*>([\s\S]*?)<\/div>/).replace(/\s*Ver menos\s*$/i, ""),
    poster: abs(poster),
    backdrop: abs(backdrop),
    genres: [...new Set(genres)].slice(0, 6),
    ajax: decode((/\bdata-ajax="([^"]+)"/.exec(s) || [])[1] || ""),
    token: (/<meta\s+name="csrf-token"\s+content="([^"]+)"/.exec(s) || /<meta\s+content="([^"]+)"\s+name="csrf-token"/.exec(s) || [])[1] || ""
  };
}
function parseEpisodeNumbers(json) {
  let o = json;
  if (typeof json === "string") {
    try {
      o = JSON.parse(json);
    } catch (_) {
      return [];
    }
  }
  const nums = (o && Array.isArray(o.eps) ? o.eps : []).map((e) => Number(e && e.num)).filter((n) => Number.isFinite(n) && n >= 0);
  return [...new Set(nums)].sort((a, b) => a - b);
}
function parsePlayers(html) {
  const out = [];
  for (const m of String(html || "").matchAll(/<button\b[^>]*\bclass="[^"]*\bplay-video\b[^"]*"[^>]*\bdata-player="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)) {
    const name = strip(m[2]);
    if (name && m[1]) out.push({ name, value: decode(m[1]) });
  }
  return out;
}
function parseIframe(html) {
  const src = (/<iframe\b[^>]*\bsrc="([^"]+)"/i.exec(String(html || "")) || [])[1];
  return src ? decode(src) : null;
}
var GENRES = [
  { slug: "k-drama", title: "K-Drama" },
  { slug: "j-drama", title: "J-Drama" },
  { slug: "c-drama", title: "C-Drama" },
  { slug: "thai-drama", title: "Thai-Drama" },
  { slug: "romance", title: "Romance" },
  { slug: "comedia", title: "Comedia" },
  { slug: "drama", title: "Drama" },
  { slug: "accion", title: "Acci\xF3n" },
  { slug: "misterio", title: "Misterio" },
  { slug: "fantasia", title: "Fantas\xEDa" },
  { slug: "historico", title: "Hist\xF3rico" },
  { slug: "escolar", title: "Escolar" }
];
function parseLatestEpisodes(html) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
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
    out.push({ slug, title, episode: Number(ep[2]), poster: img && !/capblank/.test(img) ? new URL(decode(img), SITE + "/").href : void 0 });
  }
  return out;
}
function parseFacts(html) {
  const facts = {};
  for (const m of String(html || "").matchAll(/<dt[^>]*>\s*([^<:]+):?\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) facts[strip(m[1]).toLowerCase()] = strip(m[2]);
  const year = (/\b((?:19|20)\d{2})\b/.exec(facts["fecha de emisi\xF3n"] || facts["fecha de emision"] || "") || [])[1];
  const d = facts["duraci\xF3n"] || facts["duracion"] || "";
  const hours = Number((/(\d+)\s*h/i.exec(d) || [])[1] || 0);
  const mins = Number((/(\d+)\s*min/i.exec(d) || [])[1] || 0);
  return { type: facts["tipo"], year, minutes: hours * 60 + mins || void 0 };
}

// src/extractors/mp4upload.js
var mp4upload_exports = {};
__export(mp4upload_exports, {
  HOSTS: () => HOSTS,
  extract: () => extract
});

// src/util/unpack.js
var ALPHA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
var toNum = (s, radix) => [...s].reduce((n, ch) => n * radix + ALPHA.indexOf(ch), 0);
function unpack(source) {
  const m = /}\s*\(\s*'((?:\\'|[^'])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:\\'|[^'])*)'\.split\('\|'\)/.exec(source || "");
  if (!m) return null;
  const payload = m[1].replace(/\\'/g, "'");
  const radix = Number(m[2]);
  const keys = m[4].split("|");
  if (radix < 2 || radix > 62) return null;
  return payload.replace(/\b[0-9a-zA-Z]+\b/g, (w) => {
    const i = toNum(w, radix);
    return Number.isInteger(i) && i >= 0 && keys[i] ? keys[i] : w;
  });
}

// src/extractors/shared.js
var HLS_MIME = "application/vnd.apple.mpegurl";
function fileM3u8(text2, base) {
  const m = /\bfile\s*:\s*["']([^"']+\.m3u8[^"']*)["']/.exec(text2 || "");
  return m ? absolute(m[1], base) : null;
}
function absolute(href, base) {
  try {
    return new URL(href, base).href;
  } catch (_) {
    return null;
  }
}
function findIn(html, pick) {
  return pick(html) || pick(unpack(html) || "") || null;
}
function miss(kino2, server, reason) {
  if (kino2 && typeof kino2.log === "function") kino2.log("[doramasyt]", server, reason);
  return null;
}
async function pageText(req, url, headers, kino2, server) {
  const r = await req(url, { headers });
  return r.ok ? r.text() : miss(kino2, server || "embed", "status " + r.status);
}
var LANG_CODES = [
  [/^(español|espanol|spanish|castellano|latino|spa|esp?)\b/i, "es"],
  [/^(english|inglés|ingles|eng?)\b/i, "en"],
  [/^(portugu[eê]s|portuguese|pt)\b/i, "pt"],
  // never a bare "por": "Por defecto" is not Portuguese
  [/^(fran[cç]ais|french|franc[eé]s|fre|fra|fr)\b/i, "fr"],
  [/^(italiano|italian|ita|it)\b/i, "it"],
  [/^(deutsch|german|alem[aá]n|ger|deu|de)\b/i, "de"]
];
function langCode(label) {
  const s = String(label || "").trim();
  for (const [re, code] of LANG_CODES) if (re.test(s)) return code;
  return null;
}
function captionTracks(text2, base) {
  const m = /["']?\btracks["']?\s*:\s*\[([\s\S]*?)\]/.exec(text2 || "");
  if (!m) return [];
  const out = [];
  for (const [obj] of m[1].matchAll(/\{[^{}]*\}/g)) {
    const field = (k) => (new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']*)["']`).exec(obj) || [])[1] || "";
    const kind = field("kind").toLowerCase();
    if (kind && kind !== "captions" && kind !== "subtitles") continue;
    const file = field("file");
    const format = (/\.(vtt|srt)(?:[?#]|$)/i.exec(file) || [])[1];
    const label = field("label");
    const lang = langCode(label);
    const url = format && lang ? absolute(file, base) : null;
    if (!url || out.some((t2) => t2.url === url)) continue;
    out.push({ lang, url, label, format: format.toLowerCase() });
  }
  return out;
}
function durationMsOf(text2) {
  const re = /(?<![-\w])duration["']?\s*:\s*["']?(\d+(?:\.\d+)?)(?![\d.])(?!\s*m?s\b)/g;
  for (const m of String(text2 || "").matchAll(re)) {
    const ms = Math.round(Number(m[1]) * 1e3);
    if (ms >= 6e4) return ms;
  }
  return null;
}
function pageExtras(html, base) {
  const unpacked = unpack(html) || "";
  const subs = captionTracks(html, base);
  const subtitles = subs.length ? subs : captionTracks(unpacked, base);
  const durationMs = durationMsOf(html) || durationMsOf(unpacked);
  return { ...subtitles.length ? { subtitles } : {}, ...durationMs ? { durationMs } : {} };
}

// src/extractors/mp4upload.js
var HOSTS = ["mp4upload.com"];
async function extract(embedUrl, req, kino2) {
  const html = await pageText(req, embedUrl, { Referer: "https://www.mp4upload.com/" }, kino2, "mp4upload");
  if (html == null) return null;
  const m = /player\.src\(\s*\{[^}]*?\bsrc\s*:\s*["']([^"']+)["']/.exec(html) || /\bsrc\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/.exec(html);
  const url = m && absolute(m[1], embedUrl);
  if (!url) return miss(kino2, "mp4upload", "no file in page");
  return { url, mime: "video/mp4", headers: { Referer: new URL(embedUrl).origin + "/" } };
}

// src/extractors/luluvdo.js
var luluvdo_exports = {};
__export(luluvdo_exports, {
  HOSTS: () => HOSTS2,
  extract: () => extract2
});
var HOSTS2 = ["luluvdo.com", "lulustream.com"];
async function extract2(embedUrl, req, kino2) {
  const html = await pageText(req, embedUrl, { Referer: "https://www.doramasyt.com/" }, kino2, "luluvdo");
  if (html == null) return null;
  const url = findIn(html, (t2) => fileM3u8(t2, embedUrl));
  if (!url) return miss(kino2, "luluvdo", "no playlist in page");
  return { url, mime: HLS_MIME, headers: { Referer: new URL(embedUrl).origin + "/" }, ...pageExtras(html, embedUrl) };
}

// src/extractors/mixdrop.js
var mixdrop_exports = {};
__export(mixdrop_exports, {
  HOSTS: () => HOSTS3,
  extract: () => extract3
});
var HOSTS3 = ["mxdrop.click", "mixdrop.top", "mixdrop.to", "mixdrop.co", "mixdrop.ag", "mixdrop.ch", "mixdrop.ps", "mixdrop.sx", "mixdrop.bz", "mxdrop.to"];
async function extract3(embedUrl, req, kino2) {
  const html = await pageText(req, embedUrl, { Referer: "https://www.doramasyt.com/" }, kino2, "mixdrop");
  if (html == null) return null;
  const raw = findIn(html, (t2) => (/MDCore\.wurl\s*=\s*["']([^"']+)["']/.exec(t2) || [])[1]);
  const url = raw && absolute(raw.startsWith("//") ? "https:" + raw : raw, embedUrl);
  if (!url) return miss(kino2, "mixdrop", "no file in page");
  return { url, mime: "video/mp4", headers: { Referer: new URL(embedUrl).origin + "/" } };
}

// src/extractors/streamtape.js
var streamtape_exports = {};
__export(streamtape_exports, {
  HOSTS: () => HOSTS4,
  addressOf: () => addressOf,
  extract: () => extract4
});
var HOSTS4 = ["streamtape.com", "streamtape.to", "streamtape.net", "streamta.pe", "strtape.cloud", "strcloud.link", "stape.fun", "streamadblocker.xyz"];
var LINE = /getElementById\(\s*['"](robotlink|norobotlink|ideoolink|botlink)['"]\s*\)\.innerHTML\s*=\s*(["'])([^"']*)\2\s*\+\s*(?:''\s*\+\s*)?\(\s*(["'])([^"']*)\4\s*\)((?:\s*\.substring\(\s*\d+\s*\))+)/g;
function addressOf(html) {
  const found = [];
  for (const m of String(html || "").matchAll(LINE)) {
    let tail = m[5];
    for (const [, n] of m[6].matchAll(/\.substring\(\s*(\d+)\s*\)/g)) tail = tail.substring(Number(n));
    found.push({ id: m[1], url: m[3] + tail });
  }
  const pick = found.filter((f) => /get_video\?/.test(f.url) && /token=/.test(f.url));
  const best = pick.find((f) => f.id === "robotlink") || pick.find((f) => f.id === "norobotlink") || pick[pick.length - 1];
  return best ? best.url.startsWith("//") ? "https:" + best.url : best.url : null;
}
async function extract4(embedUrl, req, kino2) {
  const html = await pageText(req, embedUrl, { Referer: "https://www.doramasyt.com/" }, kino2, "streamtape");
  if (html == null) return null;
  const url = addressOf(html);
  if (!url) return miss(kino2, "streamtape", "no address in page");
  return { url, mime: "video/mp4", headers: { Referer: new URL(embedUrl).origin + "/" } };
}

// src/extractors/index.js
var TABLE = { mp4upload: mp4upload_exports, luluvdo: luluvdo_exports, mixdrop: mixdrop_exports, streamtape: streamtape_exports };
function extractorFor(embedUrl) {
  let host;
  try {
    host = new URL(embedUrl).hostname.replace(/^www\./, "");
  } catch (_) {
    return null;
  }
  for (const [name, mod] of Object.entries(TABLE)) {
    if (mod.HOSTS.some((h) => host === h || host.endsWith("." + h))) return { name, extract: mod.extract };
  }
  return null;
}
var HOSTS5 = Object.values(TABLE).flatMap((m) => m.HOSTS);

// src/util/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
var REQUEST_MS = 8e3;
var MIN_MS = 1500;
function makeReq(kino2, { deadline }) {
  const req = async (url, opts = {}) => {
    const left = deadline - Date.now();
    if (left < MIN_MS) throw kino2.error("timeout", "no time left for " + new URL(url).hostname);
    return kino2.fetch(url, { headers: { "User-Agent": UA, ...opts.headers || {} }, method: opts.method, body: opts.body, timeoutMs: Math.min(REQUEST_MS, left) });
  };
  req.left = () => Math.max(0, deadline - Date.now());
  return req;
}

// src/art.js
var IMG = "https://image.tmdb.org/t/p/";
var DAY_MS = 24 * 60 * 60 * 1e3;
var HIT_MS = 30 * DAY_MS;
var MISS_MS = 2 * DAY_MS;
var KEY = "art2:";
var BUDGET = 24;
var BATCH = 8;
var fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
var norm = (s) => fold(s).replace(/\(\d{4}\)/g, " ").replace(/\b(latino|castellano|sub espanol)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
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
var ASIAN = /* @__PURE__ */ new Set(["ko", "ja", "zh", "cn", "th", "id", "vi", "tl", "ms", "hi"]);
var CORE = /* @__PURE__ */ new Set(["ko", "ja", "zh", "cn", "th"]);
function pickResult(results, title, { loose = true } = {}) {
  const q = norm(title);
  if (!q) return null;
  const usable2 = (Array.isArray(results) ? results : []).filter((r) => r && (r.media_type === "tv" || r.media_type === "movie" || r.media_type === void 0) && r.poster_path);
  const names = (r) => [r.name, r.title, r.original_name, r.original_title].map(norm).filter(Boolean);
  const exact = usable2.slice(0, 6).filter((r) => names(r).includes(q));
  const byName = exact.find((r) => CORE.has(r.original_language)) || exact[0] || usable2.slice(0, 3).find((r) => names(r).some((n) => n.length >= 4 && q.length >= 4 && (n.includes(q) || q.includes(n)))) || null;
  if (byName || !loose) return byName;
  return usable2.slice(0, 2).find((r) => ASIAN.has(r.original_language)) || null;
}
var read = (key) => {
  try {
    const raw = kino.storage.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};
var write = (key, v, ttlMs) => {
  try {
    kino.storage.set(key, JSON.stringify(v), { ttlMs });
  } catch (_) {
  }
};
var cachedArt = (title) => read(KEY + norm(title));
async function lookupArt(title) {
  const key = KEY + norm(title);
  const hit = read(key);
  if (hit) return hit;
  const query = String(title).slice(0, 120);
  const res = await tmdb("/search/multi", { query, language: "es-MX" });
  if (res === null) return {};
  let r = pickResult(res && res.results, title, { loose: false });
  if (!r || !CORE.has(r.original_language)) {
    const en = await tmdb("/search/multi", { query, language: "en-US" });
    const r2 = pickResult(en && en.results, title, { loose: false });
    if (r2 && (CORE.has(r2.original_language) || !r)) r = r2;
  }
  if (!r) r = pickResult(res && res.results, title);
  const art = r ? {
    poster: IMG + "w500" + r.poster_path,
    ...r.backdrop_path ? { backdrop: IMG + "w780" + r.backdrop_path } : {},
    .../^\d{4}/.test(r.first_air_date || r.release_date || "") ? { year: String((r.first_air_date || r.release_date).slice(0, 4)) } : {},
    ...r.vote_average > 0 ? { rating: Math.round(r.vote_average * 10) / 10 } : {},
    ...r.overview ? { overview: String(r.overview).slice(0, 600) } : {}
  } : {};
  write(key, art, r ? HIT_MS : MISS_MS);
  return art;
}
var apply = (item, art) => {
  if (art.poster) item.poster = art.poster;
  if (art.year && !item.year) item.year = art.year;
  if (art.rating && !item.rating) item.rating = art.rating;
};
async function addArt(items) {
  try {
    if (kino.config.get("covers") === false) return items;
  } catch (_) {
  }
  const todo = [];
  for (const item of items) {
    const hit = cachedArt(item.title);
    if (hit) apply(item, hit);
    else todo.push(item);
  }
  let spent = 0;
  let found = 0;
  const say = (msg) => {
    try {
      kino.log("art: " + msg);
    } catch (_) {
    }
  };
  say(`${items.length - todo.length} cached, ${todo.length} to look up, kino.tmdb is ${typeof kino.tmdb}`);
  try {
    while (todo.length && spent < BUDGET) {
      const batch = todo.splice(0, Math.min(BATCH, BUDGET - spent));
      spent += batch.length;
      const arts = await Promise.allSettled(batch.map((item) => lookupArt(item.title)));
      let stop = null;
      arts.forEach((a, i) => {
        if (a.status === "fulfilled") {
          apply(batch[i], a.value);
          if (a.value && a.value.poster) found++;
        } else stop = stop || a.reason;
      });
      if (stop) throw stop;
    }
  } catch (e) {
    say("stopped (" + (e && e.code || e && e.message) + ")");
  }
  say(`${spent} looked up, ${found} with a poster`);
  return items;
}
async function showArt(title) {
  try {
    return await lookupArt(title);
  } catch (_) {
    return {};
  }
}

// src/plugin.js
var RESOLVE_MS = 4e4;
var MAX_COPIES = 6;
var CACHE_MS = 10 * 60 * 1e3;
var STRINGS = {
  es: {
    onAir: "En emisi\xF3n",
    dramas: "Doramas",
    movies: "Pel\xEDculas",
    news: "Novedades",
    genres: "G\xE9neros",
    newEpisodes: "Cap\xEDtulos nuevos",
    more: "M\xE1s doramas",
    moreMovies: "M\xE1s pel\xEDculas",
    episodeShort: "Cap.",
    heroText: "Doramas en espa\xF1ol, con cap\xEDtulos nuevos cada semana.",
    statusLine: "Car\xE1tulas guardadas: {n}",
    cacheCleared: "Cach\xE9 vaciada.",
    lat: "Latino",
    esp: "Castellano",
    sub: "Subtitulado",
    episode: "Cap\xEDtulo",
    unavailable: "El servicio no est\xE1 disponible en este momento.",
    noEpisodes: "No se encontraron cap\xEDtulos de este dorama.",
    noStreams: "Ning\xFAn servidor de este cap\xEDtulo abri\xF3. Prueba m\xE1s tarde.",
    heroOnAir: "Doramas en emisi\xF3n, con cap\xEDtulos nuevos cada semana."
  },
  en: {
    onAir: "On air",
    dramas: "Dramas",
    movies: "Movies",
    news: "What's new",
    genres: "Genres",
    newEpisodes: "New episodes",
    more: "More dramas",
    moreMovies: "More movies",
    episodeShort: "Ep.",
    heroText: "Dramas in Spanish, with new episodes every week.",
    statusLine: "Covers kept: {n}",
    cacheCleared: "Cache cleared.",
    lat: "Latino",
    esp: "Castilian",
    sub: "Subtitled",
    episode: "Episode",
    unavailable: "The service is not available right now.",
    noEpisodes: "No episodes found for this drama.",
    noStreams: "No server of this episode opened. Try again later.",
    heroOnAir: "Dramas on air, with new episodes every week."
  }
};
var t = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};
var text = (r) => r.text();
async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...headers || {} }, timeoutMs: 15e3 });
  if (!r.ok) throw kino.error("unavailable", `DoramasYT ${r.status} ${url}`, { userMessage: t("unavailable") });
  return text(r);
}
async function cached(key, fn) {
  try {
    const raw = kino.storage.get("c:" + key);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS) return e.v;
  } catch (_) {
  }
  const v = await fn();
  try {
    kino.storage.set("c:" + key, JSON.stringify({ at: Date.now(), v }), { ttlMs: CACHE_MS });
  } catch (_) {
  }
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
    lang: lang === "lat" ? "es-419" : lang === "esp" ? "es-ES" : void 0
  };
  if (card.poster) item.poster = card.poster;
  if (!item.lang) delete item.lang;
  if (genreName) item.genres = [genreName];
  return item;
}
var LISTINGS = {
  emision: { path: "/emision", titleKey: "onAir", kind: "series" },
  doramas: { path: "/doramas", titleKey: "dramas", kind: "series" },
  peliculas: { path: "/doramas?categoria=pelicula", titleKey: "movies", kind: "movie" }
};
function listingOf(ref) {
  const m = /^(list|genre):([a-z0-9-]+)$/.exec(String(ref || ""));
  if (!m) return null;
  if (m[1] === "list") return LISTINGS[m[2]] ? { ...LISTINGS[m[2]], name: m[2] } : null;
  const g = GENRES.find((x) => x.slug === m[2]);
  return g ? { path: "/genero/" + g.slug, title: g.title, kind: "series", name: "genre-" + g.slug } : null;
}
function audioChoice() {
  try {
    const v = kino.config.get("audio");
    return v === "dub" || v === "sub" ? v : "all";
  } catch (_) {
    return "all";
  }
}
var byAudio = (cards) => {
  const a = audioChoice();
  if (a === "all") return cards;
  return cards.filter((c) => langOf(c.title) !== "sub" === (a === "dub"));
};
async function listing(def, page) {
  const url = SITE + def.path + (page > 1 ? (def.path.includes("?") ? "&" : "?") + "page=" + page : "");
  return cached(`${def.name}:${page}`, async () => parseCards(await getPage(url)));
}
async function rowOf(id, def, ref) {
  const cards = byAudio(await listing(def, 1));
  const items = cards.slice(0, 20).map((c) => toItem(c, def.kind, def.title));
  return items.length ? { id, title: def.title || t(def.titleKey), items, ref, genre: def.kind === "movie" ? "peliculas" : "doramas" } : null;
}
async function newEpisodesRow() {
  const cards = await cached("latest", async () => parseLatestEpisodes(await getPage(SITE + "/")));
  const shown = byAudio(cards.map((c) => ({ ...c })));
  const items = shown.slice(0, 20).map((c) => {
    const it = toItem(c, "series");
    it.badges = [`${t("episodeShort")} ${c.episode}`, ...it.badges || []];
    return it;
  });
  return items.length >= 3 ? { id: "nuevos", title: t("newEpisodes"), items, genre: "doramas" } : null;
}
var safeRow = async (id, fn) => {
  try {
    return await fn();
  } catch (e) {
    kino.log("row " + id + ": " + (e && e.message));
    return null;
  }
};
async function withArt(rows) {
  const order = [];
  for (let i = 0; i < 20; i++) for (const row of rows) if (row.items[i]) order.push(row.items[i]);
  await addArt(order);
  return rows;
}
async function home() {
  const rows = (await Promise.all([
    safeRow("nuevos", newEpisodesRow),
    ...Object.keys(LISTINGS).map((name) => safeRow(name, () => rowOf(name, listingOf("list:" + name), "list:" + name)))
  ])).filter(Boolean);
  return withArt(rows);
}
async function browse(ref, cursor) {
  const def = listingOf(ref);
  if (!def) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const cards = await listing(def, page);
  const items = byAudio(cards).map((c) => toItem(c, def.kind));
  await addArt(items);
  return { items, next: cards.length >= 24 ? String(page + 1) : void 0 };
}
async function search(arg) {
  const q = String(typeof arg === "string" ? arg : arg && arg.q || "").trim();
  if (q.length < 2) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${SITE}/buscar?q=${encodeURIComponent(q)}`)));
  return addArt(byAudio(cards).slice(0, 40).map((c) => toItem(c, "series")));
}
var SECTION_TABS = () => [
  { id: "novedades", label: t("news") },
  { id: "doramas", label: t("dramas") },
  { id: "peliculas", label: t("movies") },
  { id: "generos", label: t("genres") }
];
function heroOf(rows) {
  const first = rows.flatMap((r) => r.items)[0];
  if (!first) return void 0;
  const art = cachedArt(first.title) || {};
  const hero = { title: first.title, text: String(art.overview || t("heroText")).slice(0, 300) };
  if (art.backdrop) hero.image = art.backdrop;
  return hero;
}
async function section({ tab } = {}) {
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
async function categories() {
  return GENRES.map((g) => ({ id: "g-" + g.slug, title: g.title, ref: "genre:" + g.slug }));
}
async function details(ref) {
  const m = /^[dm]:([a-z0-9-]+)$/i.exec(String(ref || ""));
  if (!m) return null;
  const html = await getPage(`${SITE}/dorama/${m[1]}`);
  const show = parseShow(html);
  const facts = parseFacts(html);
  const name = show.title.replace(/\s+(latino|castellano)$/i, "").trim() || show.title;
  const art = await showArt(name);
  const out = { overview: show.overview || art.overview, genres: show.genres.length ? show.genres : void 0, year: facts.year || art.year, runtimeMinutes: facts.minutes, rating: art.rating, backdrop: art.backdrop || show.backdrop, poster: art.poster || show.poster };
  for (const k of Object.keys(out)) if (out[k] === void 0 || out[k] === "") delete out[k];
  return out;
}
async function settingsStatus() {
  let n = 0;
  try {
    n = kino.storage.keys().filter((k) => k.startsWith("art2:")).length;
  } catch (_) {
  }
  return { info: t("statusLine").replace("{n}", String(n)) };
}
async function action(key) {
  if (key === "clearCache") {
    try {
      for (const k of kino.storage.keys()) if (k.startsWith("art2:") || k.startsWith("c:")) kino.storage.remove(k);
    } catch (_) {
    }
    return { message: t("cacheCleared") };
  }
  return { message: "" };
}
async function showEpisodes(slug) {
  const url = `${SITE}/dorama/${slug}`;
  const html = await getPage(url);
  const show = parseShow(html);
  if (!show.ajax) throw kino.error("not_found", "no caplist on " + url, { userMessage: t("noEpisodes") });
  const r = await kino.fetch(show.ajax, {
    method: "POST",
    headers: { "User-Agent": UA, "X-Requested-With": "XMLHttpRequest", Referer: url, Origin: SITE, Accept: "application/json, text/javascript, */*; q=0.01" },
    body: { form: { _token: show.token } },
    timeoutMs: 15e3
  });
  if (!r.ok) throw kino.error("unavailable", "caplist " + r.status, { userMessage: t("unavailable") });
  const numbers = parseEpisodeNumbers(await text(r));
  if (!numbers.length) throw kino.error("not_found", "no episodes for " + slug, { userMessage: t("noEpisodes") });
  return { show, numbers };
}
async function episodes(ref) {
  const slug = /^[dm]:([a-z0-9-]+)$/i.exec(String(ref || ""))?.[1];
  if (!slug) throw kino.error("not_found", "unknown ref: " + ref);
  const { show, numbers } = await showEpisodes(slug);
  const name = show.title.replace(/\s+(latino|castellano)$/i, "").trim();
  const art = await showArt(name || show.title);
  const series = { title: name || void 0, poster: art.poster || show.poster, backdrop: art.backdrop || show.backdrop, overview: show.overview || art.overview || void 0, genres: show.genres.length ? show.genres : void 0, year: art.year, rating: art.rating };
  for (const k of Object.keys(series)) if (series[k] === void 0) delete series[k];
  return {
    series,
    episodes: numbers.map((n) => ({ season: 1, number: n, ref: `e:${slug}:${n}`, title: `${t("episode")} ${n}` }))
  };
}
var PREFERENCE = [/mp4upload/i, /lulu/i, /streamtape/i, /(mxdrop|mixdrop)/i];
var rank = (name) => {
  const i = PREFERENCE.findIndex((re) => re.test(name));
  return i < 0 ? 99 : i;
};
var SERVER_NAMES = { mp4upload: "Mp4Upload", lulu: "LuluVdo", streamtape: "StreamTape", mixdrop: "MixDrop", mxdrop: "MixDrop" };
var prettyName = (name) => {
  const k = Object.keys(SERVER_NAMES).find((x) => new RegExp(x, "i").test(name));
  return k ? SERVER_NAMES[k] : name;
};
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
  return { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...out.headers || {} }, label: `${t(lang)} \xB7 ${prettyName(name)}`, ...out.subtitles ? { subtitles: out.subtitles } : {}, ...out.durationMs ? { durationMs: out.durationMs } : {} };
}
async function resolve(ref) {
  const m = /^(?:(e):([a-z0-9-]+):(\d+)|(m):([a-z0-9-]+)|(c):([a-z0-9-]+):(\d+):([0-9]))$/i.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  const slug = m[2] || m[5] || m[7];
  const only = m[6] ? Number(m[9]) : null;
  const lang = langOf(slug);
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const wantedN = Number(m[3] || m[8]);
  const tries = m[4] ? [0, 1] : wantedN === 1 ? [1, 0] : [wantedN];
  let number = tries[0], pageUrl = watchUrl(slug, number), html = null, lastError = null;
  for (const n of tries) {
    number = n;
    pageUrl = watchUrl(slug, n);
    try {
      html = await getPage(pageUrl, { Referer: `${SITE}/dorama/${slug}` });
      break;
    } catch (e) {
      lastError = e;
    }
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
      if (!out) {
        failures.push(`${player.name}: no stream`);
        continue;
      }
      const stream = streamOf(out, lang, player.name);
      if (only == null) {
        const others = players.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${slug}:${number}:${j}`, label: `${t(lang)} \xB7 ${prettyName(players[j].name)}` }));
      }
      return stream;
    } catch (e) {
      failures.push(`${player.name}: ${e && e.message || e}`);
    }
  }
  kino.log("resolve " + baseOf(slug) + " " + number + " failed: " + failures.join("; "));
  throw kino.error("not_found", "no player opened for " + pageUrl, { userMessage: t("noStreams") });
}
export {
  action,
  browse,
  categories,
  details,
  episodes,
  home,
  resolve,
  search,
  section,
  settingsStatus
};
