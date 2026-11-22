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

// src/browse/model.js
var MAX_SLIDES = 6;
var MAX_RAILS = 8;
var MAX_RAIL_ITEMS = 20;
var MAX_SLIDE_TEXT = 160;
var HTTPS = /^https:\/\//;
function cardOf(item) {
  const out = { id: item.id, ref: item.ref, title: item.title, kind: item.kind };
  if (item.poster && HTTPS.test(item.poster)) out.poster = item.poster;
  if (item.backdrop && HTTPS.test(item.backdrop)) out.backdrop = item.backdrop;
  if (item.year !== void 0) out.year = item.year;
  if (item.lang) out.lang = item.lang;
  return out;
}
function slidesOf(rows) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const item of row.items) {
      if (out.length >= MAX_SLIDES) return out;
      const image = item.backdrop && HTTPS.test(item.backdrop) ? item.backdrop : item.poster;
      if (seen.has(item.id) || !image || !HTTPS.test(image)) continue;
      const text2 = typeof item.overview === "string" ? item.overview.trim() : "";
      if (text2 === "") continue;
      seen.add(item.id);
      out.push({ id: item.id, ref: item.ref, kind: item.kind, title: item.title, image, text: text2.length <= MAX_SLIDE_TEXT ? text2 : `${text2.slice(0, MAX_SLIDE_TEXT - 1).trimEnd()}\u2026` });
    }
  }
  return out;
}
function railsOf(rows) {
  return rows.filter((r) => !r.hidden && r.items && r.items.length > 0).slice(0, MAX_RAILS).map((r) => ({
    id: r.id,
    title: r.title,
    ...r.titleEn ? { titleEn: r.titleEn } : {},
    ...r.ref ? { ref: r.ref } : {},
    items: r.items.slice(0, MAX_RAIL_ITEMS).map(cardOf)
  }));
}
function tabOf(page) {
  const rows = page && Array.isArray(page.rows) ? page.rows : [];
  const rails = railsOf(rows);
  if (rails.length === 0) return null;
  return { slides: slidesOf(rows), rails };
}
function recentOf(keys, tabs) {
  if (keys.length === 0) return [];
  const byRef = /* @__PURE__ */ new Map();
  for (const data of tabs) for (const rail2 of data.rails) for (const card of rail2.items) if (!byRef.has(card.ref)) byRef.set(card.ref, card);
  const out = [];
  const used = /* @__PURE__ */ new Set();
  for (const key of keys) {
    const card = byRef.get(key);
    if (card && !used.has(card.id)) {
      used.add(card.id);
      out.push(card);
    }
  }
  return out;
}

// src/i18n.js
var T = {
  brWatch: ["Ver ahora", "Watch now"],
  brInfo: ["M\xE1s informaci\xF3n", "More info"],
  brRecent: ["Continuar viendo", "Continue watching"],
  brEmpty: ["No hay t\xEDtulos para mostrar ahora.", "There is nothing to show right now."],
  brFailed: ["No se pudo cargar esta secci\xF3n. Revisa tu conexi\xF3n.", "This section could not be loaded. Check your connection."],
  brRetry: ["Reintentar", "Retry"],
  brClose: ["Cerrar", "Close"],
  brBack: ["Atr\xE1s", "Back"],
  brSearch: ["Buscar", "Search"],
  brSettings: ["Ajustes", "Settings"],
  brSearchHint: ["Escribe un t\xEDtulo", "Type a title"],
  brSearchTitle: ["Buscar", "Search"],
  brSearchFailed: ["La b\xFAsqueda no respondi\xF3. Intenta de nuevo.", "The search did not answer. Try again."],
  brNoResults: ["No encontramos nada con esas palabras.", "Nothing matched those words."],
  brSearchedBefore: ["Buscados antes", "Searched before"],
  noServer: ["Esta pel\xEDcula no tiene ahora un servidor que abra. Intenta de nuevo m\xE1s tarde.", "This movie has no server that opens right now. Try again later."],
  siteDown: ["El cat\xE1logo no responde ahora. Intenta de nuevo en un rato.", "The catalog is not answering right now. Try again in a moment."]
};
function both(key, vars = {}) {
  const pair = T[key] || [key, key];
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => k in vars ? String(vars[k]) : "");
  return { es: fill(pair[0]), en: fill(pair[1]) };
}

// src/browse/view.js
var POLL_MS = 1500;
var SEARCH_CAP = 60;
var twin = (key, field = "text", vars) => {
  const w = both(key, vars);
  return { [field]: w.es, [field + "En"]: w.en };
};
var tabLabel = (tab) => ({ label: tab.es, labelEn: tab.en });
var railSkeleton = (n) => ({
  type: "Column",
  key: "skel" + n,
  gap: 8,
  children: [
    { type: "Skeleton", shape: "line", width: 120 },
    { type: "Row", gap: 12, sizes: ["compact"], children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}c${i}`, flex: 1 })) },
    { type: "Row", gap: 12, sizes: ["medium", "expanded"], children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}w${i}`, flex: 1 })) }
  ]
});
var gridSkeleton = () => ({
  type: "Column",
  key: "gridSkeleton",
  gap: 12,
  children: [
    ...[1, 2].map((r) => ({ type: "Row", gap: 12, sizes: ["compact"], key: `gc${r}`, children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `gc${r}-${i}`, flex: 1 })) })),
    ...[1, 2].map((r) => ({ type: "Row", gap: 12, sizes: ["medium", "expanded"], key: `gw${r}`, children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `gw${r}-${i}`, flex: 1 })) }))
  ]
});
var heroSkeleton = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var slideNode = (s, canPlay) => ({
  type: "heroCard",
  key: "slide-" + s.id,
  h: { compact: 200, expanded: 240 },
  ...s.logo ? { logo: s.logo } : {},
  title: s.title,
  text: s.text,
  image: s.image,
  buttons: canPlay ? [
    { type: "ElevatedButton", key: "watch-" + s.id, ...twin("brWatch", "labelText"), icon: "play", onPressed: { go: { play: { ref: s.ref, kind: s.kind, id: s.id, title: s.title } } } },
    { type: "TextButton", key: "info-" + s.id, ...twin("brInfo", "labelText"), onPressed: { go: { title: { ref: s.ref, kind: s.kind, id: s.id, title: s.title } } } }
  ] : [
    { type: "ElevatedButton", key: "watch-" + s.id, ...twin("brWatch", "labelText"), icon: "play", onPressed: { go: { title: { ref: s.ref, kind: s.kind, id: s.id, title: s.title } } } }
  ]
});
var hero = (slides, canPlay) => slides.length === 1 ? slideNode(slides[0], canPlay) : { type: "PageView", key: "hero" + slides.length, autoPlayMs: 6e3, children: slides.map((x) => slideNode(x, canPlay)) };
var rail = (r, key, titleOverride) => ({
  type: "titleRail",
  key,
  ...titleOverride || { title: r.title, ...r.titleEn ? { titleEn: r.titleEn } : {} },
  ...r.ref ? { ref: r.ref } : {},
  items: r.items,
  size: "medium"
});
var brandNode = (brand) => ({ type: "Text", key: "logo", text: brand, textEn: brand, style: "h4" });
var tabBar = (tabs, active) => ({ type: "TabBar", key: "tabs", divider: false, value: active, onChanged: "tab", tabs: tabs.map((t2) => ({ value: t2.id, ...tabLabel(t2) })) });
function browseView({ brand, tabs, tab, data, recent, pending, failed, canPlay = false, device = "phone" }) {
  const tv = device === "tv";
  const active = tabs.some((t2) => t2.id === tab) ? tab : tabs[0].id;
  const body = [];
  if (data) {
    if (data.slides.length > 0) body.push(hero(data.slides, canPlay));
    if (recent.length > 0) body.push(rail({ items: recent }, "recent", twin("brRecent", "title")));
    for (const r of data.rails) body.push(rail(r, "rail-" + String(r.id).replace(/[^A-Za-z0-9_-]/g, "_")));
    if (data.rails.length === 0) body.push({ type: "Text", ...twin("brEmpty", "text"), color: "muted" });
  } else if (failed) {
    body.push({ type: "MaterialBanner", key: "loadFailed", role: "error", ...twin("brFailed"), action: { ...twin("brRetry", "label"), onTap: "retry" } });
  } else {
    body.push(heroSkeleton(), railSkeleton(1), railSkeleton(2), railSkeleton(3));
  }
  const gear = { type: "IconButton", key: "settingsButton", icon: "settings", ...twin("brSettings", "labelText"), ...twin("brSettings", "tooltip"), onPressed: { event: "go", arg: "settings" } };
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "close", icon: "close", ...twin("brClose", "labelText"), ...twin("brClose", "tooltip"), onPressed: { go: { close: true } } },
      // On a TV the search is a button of the bar (a floating one is hard to reach with a remote); elsewhere it floats.
      actions: tv ? [{ type: "IconButton", key: "searchButton", icon: "search", ...twin("brSearch", "labelText"), ...twin("brSearch", "tooltip"), onPressed: "openSearch" }, gear] : [gear],
      // On a TV the tabs sit in the bar beside the name (one row, one D-pad strip); elsewhere they are pinned under it.
      title: tv ? { type: "Row", key: "titleRow", gap: 24, crossAxisAlignment: "center", children: [brandNode(brand), tabBar(tabs, active)] } : brandNode(brand)
    },
    ...tv ? {} : { floatingActionButton: { type: "FloatingActionButton", key: "searchFab", icon: "search", ...twin("brSearch", "tooltip"), onPressed: "openSearch" } },
    body: { type: "Column", key: "page", children: [
      ...tv ? [] : [{ type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(tabs, active)] }],
      { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] }
    ] },
    ...pending ? { every: { ms: POLL_MS, event: "tick" } } : {}
  };
}
function searchView({ query, status, items, history = [], device = "phone" }) {
  const tv = device === "tv";
  const searchForm = () => ({
    type: "Form",
    key: "searchForm",
    onSubmitted: "search",
    gap: 8,
    children: tv ? [{ type: "Row", key: "searchRow", gap: 16, crossAxisAlignment: "center", children: [
      { type: "TextField", key: "q", kind: "text", value: query, ...twin("brSearchHint", "labelText"), maxLength: 100, autofocus: true, weight: 1 },
      { type: "ElevatedButton", key: "searchGo", ...twin("brSearch", "labelText"), icon: "search", submit: true }
    ] }] : [
      { type: "TextField", key: "q", kind: "text", value: query, ...twin("brSearchHint", "labelText"), maxLength: 100, autofocus: true },
      { type: "ElevatedButton", key: "searchGo", ...twin("brSearch", "labelText"), icon: "search", submit: true }
    ]
  });
  const body = tv ? [] : [searchForm()];
  if (status === "fail") {
    body.push({ type: "MaterialBanner", key: "searchFailed", role: "error", ...twin("brSearchFailed"), action: { ...twin("brRetry", "label"), onTap: "sretry" } });
  } else if (status === "done" && items) {
    if (items.length === 0) body.push({ type: "Text", ...twin("brNoResults", "text"), color: "muted" });
    else body.push({ type: "titleGrid", key: "results", columns: { compact: 3, expanded: 6 }, items: items.slice(0, SEARCH_CAP) });
  } else if (status !== "idle") {
    body.push(gridSkeleton());
  } else if (history.length > 0) {
    body.push({ type: "Text", ...twin("brSearchedBefore", "text"), style: "h4" });
    body.push({ type: "titleGrid", key: "history", columns: { compact: 3, expanded: 6 }, items: history.slice(0, SEARCH_CAP) });
  }
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "back", icon: "arrow_back", ...twin("brBack", "labelText"), ...twin("brBack", "tooltip"), onPressed: "back" },
      ...tv ? { title: searchForm() } : twin("brSearchTitle", "title")
    },
    body: { type: "SingleChildScrollView", key: "search-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] },
    ...status === "loading" ? { every: { ms: 1e3, event: "stick" } } : {}
  };
}
function settingsView({ brand }) {
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "back", icon: "arrow_back", ...twin("brBack", "labelText"), ...twin("brBack", "tooltip"), onPressed: "back" },
      title: brandNode(brand)
    },
    body: { type: "SingleChildScrollView", key: "settings-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [{ type: "settings", key: "form" }] }] }
  };
}

// src/browse/metaCache.js
var KEY = "meta1";
var MAX = 120;
var CALL_MS = 8e3;
var HTTPS2 = /^https:\/\//;
function makeMetaCache({ kino: kino2, titleOf = (c) => c.title, clock = { now: () => Date.now() } }) {
  const usable2 = () => {
    try {
      return typeof kino2.meta === "function" && kino2.meta.byTitle === true;
    } catch (_) {
      return false;
    }
  };
  let book = null;
  function read2() {
    if (book) return book;
    try {
      const o = JSON.parse(kino2.storage.get(KEY) || "null");
      book = o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (_) {
      book = {};
    }
    return book;
  }
  function write2() {
    try {
      const ids = Object.keys(book);
      if (ids.length > MAX) for (const id of ids.slice(0, ids.length - MAX)) delete book[id];
      kino2.storage.set(KEY, JSON.stringify(book));
    } catch (_) {
    }
  }
  function known(id) {
    const e = read2()[id];
    if (!e) return {};
    return { ...e.t > 0 ? { tmdb: e.t } : {}, ...e.l && HTTPS2.test(e.l) ? { logo: e.l } : {} };
  }
  function dress(cards) {
    return cards.map((c) => {
      const k = known(c.id);
      return k.tmdb && !(c.ids && c.ids.tmdb) ? { ...c, ids: { ...c.ids || {}, tmdb: k.tmdb } } : c;
    });
  }
  async function fill(cards, budgetMs) {
    if (!usable2()) return 0;
    const b = read2();
    const end = clock.now() + budgetMs;
    let asked = 0;
    for (const c of cards) {
      if (clock.now() + CALL_MS > end) break;
      if (!c || typeof c.id !== "string" || Object.hasOwn(b, c.id) || c.ids && c.ids.tmdb && c.noLogo) continue;
      const year = c.year !== void 0 ? { year: c.year } : {};
      try {
        const a = await kino2.meta({ type: c.kind === "series" ? "series" : "movie", title: titleOf(c), ...year });
        b[c.id] = { t: a && a.ids && Number.isInteger(a.ids.tmdb) ? a.ids.tmdb : 0, l: a && typeof a.logo === "string" ? a.logo : "" };
      } catch (e) {
        if (e && e.code === "rate_limited") break;
        continue;
      }
      asked++;
    }
    if (asked > 0) write2();
    return asked;
  }
  return { known, dress, fill, usable: usable2 };
}

// src/browse/index.js
var SNAP_TTL_MS = 12 * 3600 * 1e3;
var SNAP_MAX = 20 * 1024;
var RECENT_MAX = 12;
var HIST_MAX = 24;
function makeBrowse({ kino: kino2, brand, tabs, loadTab, searchTitles, canPlay = false, titleOf }) {
  const TAB_IDS = tabs.map((t2) => t2.id);
  const TAB_KEY = "browseTab";
  const SNAP_PREFIX = "browse1:";
  const RECENT_KEY = "recent1";
  const HIST_KEY = "searchHist1";
  const meta = makeMetaCache({ kino: kino2, titleOf });
  const enrich = (data) => data ? {
    slides: data.slides.map((s) => {
      const k = meta.known(s.id);
      return k.logo ? { ...s, logo: k.logo } : s;
    }),
    rails: data.rails.map((r) => ({ ...r, items: meta.dress(r.items) }))
  } : data;
  const memo = /* @__PURE__ */ new Map();
  const log = (...a) => {
    try {
      kino2.log("[" + brand + "]", ...a);
    } catch (_) {
    }
  };
  const get = (k) => {
    try {
      return kino2.storage.get(k);
    } catch (_) {
      return null;
    }
  };
  const set = (k, v, opts) => {
    try {
      kino2.storage.set(k, v, opts);
    } catch (_) {
    }
  };
  function readSnap(tab) {
    try {
      const o = JSON.parse(get(SNAP_PREFIX + tab) || "null");
      return o && Date.now() - o.at < SNAP_TTL_MS && o.data && Array.isArray(o.data.rails) ? o.data : null;
    } catch (_) {
      return null;
    }
  }
  function writeSnap(tab, data) {
    for (let per = 10; per >= 3; per -= 2) {
      const slim2 = { slides: data.slides, rails: data.rails.map((r) => ({ ...r, items: r.items.slice(0, per) })) };
      const text2 = JSON.stringify({ at: Date.now(), data: slim2 });
      if (text2.length <= SNAP_MAX) {
        set(SNAP_PREFIX + tab, text2, { ttlMs: SNAP_TTL_MS });
        return;
      }
    }
  }
  const stored = () => {
    const t2 = get(TAB_KEY);
    return TAB_IDS.includes(t2) ? t2 : null;
  };
  const remember = (tab) => set(TAB_KEY, tab);
  function dataOf(tab) {
    if (memo.has(tab)) return memo.get(tab).data;
    const snap = readSnap(tab);
    if (snap) {
      memo.set(tab, { data: snap, whole: false });
      return snap;
    }
    return null;
  }
  const readKeys = () => {
    try {
      const a = JSON.parse(get(RECENT_KEY) || "[]");
      return Array.isArray(a) ? a.filter((k) => typeof k === "string") : [];
    } catch (_) {
      return [];
    }
  };
  function notePlayed(ref) {
    try {
      const key = String(ref || "");
      if (key === "") return;
      const keys = readKeys();
      if (keys[0] === key) return;
      set(RECENT_KEY, JSON.stringify([key, ...keys.filter((k) => k !== key)].slice(0, RECENT_MAX)));
    } catch (_) {
    }
  }
  const slim = (c) => ({ id: c.id, ref: c.ref, title: c.title, kind: c.kind, ...c.poster ? { poster: c.poster } : {} });
  function readHistory() {
    try {
      const a = JSON.parse(get(HIST_KEY) || "[]");
      return Array.isArray(a) ? a.filter((c) => c && typeof c.id === "string" && typeof c.ref === "string" && typeof c.title === "string").slice(0, HIST_MAX) : [];
    } catch (_) {
      return [];
    }
  }
  function rememberFound(cards) {
    try {
      const fresh = cards.slice(0, 12).map(slim);
      const ids = new Set(fresh.map((c) => c.id));
      set(HIST_KEY, JSON.stringify([...fresh, ...readHistory().filter((c) => !ids.has(c.id))].slice(0, HIST_MAX)));
    } catch (_) {
    }
  }
  let found = null;
  const tabFromArgs = (route) => {
    const a = route && route.args && typeof route.args === "object" ? route.args : {};
    return TAB_IDS.includes(a.tab) ? a.tab : null;
  };
  function needed(tab, device) {
    const order = [tab, ...TAB_IDS.filter((t2) => t2 !== tab)];
    return order.filter((t2, i) => (i === 0 || device !== "tv") && !(memo.get(t2) && memo.get(t2).whole));
  }
  function view(ctx) {
    const st = ctx.state && typeof ctx.state === "object" ? ctx.state : {};
    if (ctx.route && ctx.route.name === "settings") return settingsView({ brand });
    if (ctx.route && ctx.route.name === "search") {
      const query = typeof st.sq === "string" ? st.sq : "";
      const items = found && found.q === query ? found.items : null;
      const status = query === "" ? "idle" : st.sstate === "fail" ? "fail" : items ? "done" : "loading";
      return searchView({ query, status, items, history: query === "" ? readHistory() : [], device: ctx.device });
    }
    const tab = TAB_IDS.includes(st.tab) ? st.tab : tabFromArgs(ctx.route) ?? stored() ?? TAB_IDS[0];
    const data = enrich(dataOf(tab));
    const loaded = TAB_IDS.map((t2) => memo.get(t2)).filter(Boolean).map((m) => m.data);
    const pending = Array.isArray(st.pending) && st.pending.length > 0;
    return browseView({ brand, tabs, tab, data, recent: meta.dress(recentOf(readKeys(), loaded)), pending, failed: !!(st.failed && st.failed[tab]), canPlay, device: ctx.device });
  }
  async function load(tab) {
    const page = await loadTab(tab);
    const data = tabOf(page);
    if (data) {
      memo.set(tab, { data, whole: true });
      writeSnap(tab, data);
    }
    return data !== null;
  }
  const events = {
    open({ route, state, device }) {
      const tab = tabFromArgs(route) ?? (TAB_IDS.includes(state.tab) ? state.tab : stored() ?? TAB_IDS[0]);
      for (const t2 of TAB_IDS) dataOf(t2);
      return { state: { tab, pending: needed(tab, device), failed: null } };
    },
    tab({ value, arg, state }) {
      const tab = TAB_IDS.includes(value) ? value : TAB_IDS.includes(arg) ? arg : null;
      if (!tab) return null;
      remember(tab);
      dataOf(tab);
      const failed = { ...state.failed || {} };
      delete failed[tab];
      const pending = [tab, ...Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : []];
      return { state: { tab, pending: memo.get(tab) && memo.get(tab).whole ? pending.slice(1) : pending, failed } };
    },
    retry({ state, device }) {
      const tab = TAB_IDS.includes(state.tab) ? state.tab : TAB_IDS[0];
      return { state: { failed: null, pending: [tab, ...needed(tab, device).filter((t2) => t2 !== tab)] } };
    },
    async tick({ state }) {
      const pending = Array.isArray(state.pending) ? state.pending : [];
      if (pending.length === 0) return null;
      const [next, ...rest] = pending;
      const failed = { ...state.failed || {} };
      if (next.startsWith("meta:")) {
        const m = memo.get(next.slice(5));
        if (m) await meta.fill([...m.data.slides.map((s) => ({ id: s.id, title: s.title, kind: s.kind })), ...m.data.rails.flatMap((r) => r.items.slice(0, 6).map((c) => ({ id: c.id, title: c.title, kind: c.kind })))], 12e3);
        return { state: { pending: rest } };
      }
      try {
        const ok = await load(next);
        if (!ok) failed[next] = true;
        else delete failed[next];
        if (ok && meta.usable()) rest.unshift("meta:" + next);
      } catch (e) {
        log("browse tab", e && e.code || "error");
        failed[next] = true;
      }
      return { state: { pending: rest, failed } };
    },
    // The floating button: straight to the search page, empty and ready for the words.
    openSearch() {
      return { route: { push: "search" }, state: { sq: "", sstate: null } };
    },
    search({ value, route }) {
      const q = value && typeof value.q === "string" ? value.q.trim().slice(0, 100) : "";
      if (q === "") return null;
      const state = { sq: q, sstate: "loading" };
      return route && route.name === "search" ? { state } : { route: { push: "search" }, state };
    },
    // The search page's timer: one search per press, then no timer.
    async stick({ state }) {
      const q = typeof state.sq === "string" ? state.sq : "";
      if (q === "" || state.sstate !== "loading") return null;
      try {
        const out = await searchTitles(q);
        found = { q, items: (Array.isArray(out) ? out : []).slice(0, 60).map(cardOf) };
        rememberFound(found.items);
        return { state: { sstate: "done" } };
      } catch (e) {
        log("browse search", e && e.code || "error");
        return { state: { sstate: "fail" } };
      }
    },
    sretry({ state }) {
      return typeof state.sq === "string" && state.sq !== "" ? { state: { sstate: "loading" } } : null;
    },
    // The gear: the plugin's settings are a page of their own, one Back away.
    go({ arg }) {
      return arg === "settings" ? { route: { push: "settings" }, state: { fromBrowse: true } } : null;
    },
    back({ state, route }) {
      if (route && route.name === "settings" && !state.fromBrowse) return { close: true };
      return { route: { pop: true }, state: { sq: null, sstate: null } };
    }
  };
  async function event(ev) {
    const handler = Object.hasOwn(events, ev.name) ? events[ev.name] : null;
    return handler ? await handler({ ...ev, state: ev.state || {} }) ?? null : null;
  }
  return { view, event, notePlayed };
}

// src/resolve-door.js
var HLS_MIME = "application/vnd.apple.mpegurl";
var RESOLVER_ALIAS = "resolver";
var RESOLVER_REPO = "xuper-plugin/kino-plugin-kino-resolver";
var CAPTURE_MS = 2e4;
function headersOf(s) {
  const out = {};
  if (s.referer) out.Referer = s.referer;
  const h = s.headers;
  if (Array.isArray(h)) for (const x of h) {
    if (x && x.name) out[x.name] = String(x.value);
  }
  else if (h && typeof h === "object") for (const [k, v] of Object.entries(h)) {
    if (v != null) out[k] = String(v);
  }
  return out;
}
function pickBest(streams) {
  return streams.find((s) => s && s.url && (s.kind === "hls" || /\.m3u8(\?|$)/i.test(s.url))) || streams.find((s) => s && s.url) || null;
}
async function captureStreams(kino2, embedUrl, referer) {
  const b = kino2 && kino2.browser;
  if (!b || typeof b.capture !== "function") return [];
  const opts = { timeoutMs: CAPTURE_MS, match: "\\.m3u8|\\.mp4" };
  if (referer) opts.headers = { Referer: referer };
  let cap;
  try {
    cap = await b.capture(embedUrl, opts);
  } catch (_) {
    return [];
  }
  const out = [];
  for (const m of cap && cap.media || []) {
    if (!m || !m.url) continue;
    out.push({ url: m.url, kind: /\.m3u8(\?|$)/i.test(m.url) ? "hls" : "mp4", server: "browser", headers: m.headers || {} });
  }
  return out;
}
async function resolveViaHelper(embedUrl, kino2, referer, allowCapture = true) {
  let res = null;
  try {
    res = await kino2.plugins.call(RESOLVER_ALIAS, "resolve", { url: embedUrl, referer });
  } catch (err) {
    try {
      kino2.log("[doramasyt]", "resolver", err && err.code || "call_failed");
    } catch (_) {
    }
  }
  let streams = res && Array.isArray(res.streams) ? res.streams.slice() : [];
  const subtitles = res && Array.isArray(res.subtitles) ? res.subtitles.filter((x) => x && x.lang && x.url) : [];
  let captured = false;
  if (!streams.length && allowCapture) {
    streams = await captureStreams(kino2, embedUrl, referer);
    captured = streams.length > 0;
  }
  const s = pickBest(streams);
  if (!s) return null;
  const headers = headersOf(s);
  const isHls = s.kind === "hls" || /\.m3u8(\?|$)/i.test(s.url);
  return {
    url: s.url,
    mime: isHls ? HLS_MIME : /\.mp4(\?|$)/i.test(s.url) ? "video/mp4" : void 0,
    ...Object.keys(headers).length ? { headers } : {},
    ...captured ? { captured: true } : {},
    ...subtitles.length ? { subtitles } : {}
  };
}
async function resolverInstalled(kino2) {
  try {
    await kino2.plugins.call(RESOLVER_ALIAS, "normalizeHost", { url: "https://probe.invalid/" });
    return true;
  } catch (err) {
    return (err && err.code) !== "provider_missing";
  }
}

// src/util/terms.js
function searchTerms(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  const norm2 = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const out = [];
  const add = (s) => {
    const v = String(s || "").trim();
    if (v.length >= 2 && !out.some((x) => norm2(x) === norm2(v))) out.push(v);
  };
  add(q);
  if (arg && typeof arg === "object") {
    add(arg.originalTitle);
    for (const a of Array.isArray(arg.altTitles) ? arg.altTitles : []) add(a);
  }
  add(q.split(/\s*[:\-–—]\s*/)[0]);
  return out.slice(0, 4);
}
async function searchWithTerms(arg, one) {
  for (const q of searchTerms(arg)) {
    const found = await one(arg && typeof arg === "object" ? { ...arg, q } : q);
    if (found.length) return found;
  }
  return [];
}

// src/art.js
var IMG = "https://image.tmdb.org/t/p/";
var DAY_MS = 24 * 60 * 60 * 1e3;
var HIT_MS = 30 * DAY_MS;
var MISS_MS = 2 * DAY_MS;
var KEY2 = "art2:";
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
var cachedArt = (title) => read(KEY2 + norm(title));
async function lookupArt(title) {
  const key = KEY2 + norm(title);
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

// src/util/home.js
var BUDGET_MS = 11e3;
var KEEP_MS = 12 * 60 * 60 * 1e3;
var MAX_CHARS = 60 * 1024;
function keep(key, rows) {
  try {
    for (let per = 20; per >= 4; per -= 4) {
      const text2 = JSON.stringify({ at: Date.now(), rows: rows.map((r) => ({ ...r, items: Array.isArray(r.items) ? r.items.slice(0, per) : r.items })) });
      if (text2.length <= MAX_CHARS) {
        kino.storage.set(key, text2, { ttlMs: KEEP_MS });
        return;
      }
    }
  } catch (_) {
  }
}
function kept(key) {
  try {
    const o = JSON.parse(kino.storage.get(key) || "null");
    return o && Date.now() - o.at < KEEP_MS && Array.isArray(o.rows) && o.rows.length ? o.rows : null;
  } catch (_) {
    return null;
  }
}
async function homeWithin(jobs, { key = "home:last", budgetMs = BUDGET_MS } = {}) {
  const out = jobs.map(() => null);
  let done = false;
  const all = Promise.all(jobs.map((job, i) => Promise.resolve().then(job).then((row) => {
    out[i] = row;
  }, () => {
  }))).then(() => {
    done = true;
  });
  const end = Date.now() + budgetMs;
  while (!done && Date.now() < end) await Promise.race([all, kino.sleep(Math.min(250, Math.max(1, end - Date.now())))]);
  const rows = out.filter(Boolean);
  if (rows.length) {
    keep(key, rows);
    return rows;
  }
  return kept(key) || [];
}
async function within(ms, work) {
  let done = false;
  const p = Promise.resolve(work).then(() => {
    done = true;
  }, () => {
    done = true;
  });
  const end = Date.now() + ms;
  while (!done && Date.now() < end) await Promise.race([p, kino.sleep(Math.min(250, Math.max(1, end - Date.now())))]);
}

// src/plugin.js
globalThis.__kinoDropPendingFetches = true;
var RESOLVE_MS = 4e4;
var MAX_COPIES = 8;
var MAX_CAPTURES = 1;
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
    heroOnAir: "Doramas en emisi\xF3n, con cap\xEDtulos nuevos cada semana.",
    needResolver: "Para reproducir, abre DoramasYT desde el men\xFA e instala el motor de reproducci\xF3n que te pedir\xE1."
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
    heroOnAir: "Dramas on air, with new episodes every week.",
    needResolver: "To play, open DoramasYT from the menu and install the playback engine it asks for."
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
  if (Array.isArray(v) && !v.length) return v;
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
  const started = Date.now();
  const rows = await homeWithin([
    () => safeRow("nuevos", newEpisodesRow),
    ...Object.keys(LISTINGS).map((name) => () => safeRow(name, () => rowOf(name, listingOf("list:" + name), "list:" + name)))
  ], { budgetMs: 8e3 });
  await within(Math.max(0, 13e3 - (Date.now() - started)), withArt(rows));
  return rows;
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
async function searchOne(arg) {
  const q = String(typeof arg === "string" ? arg : arg && arg.q || "").trim();
  if (q.length < 2) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${SITE}/buscar?q=${encodeURIComponent(q)}`)));
  return addArt(byAudio(cards).slice(0, 40).map((c) => toItem(c, "series")));
}
var search = (arg) => searchWithTerms(arg, searchOne);
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
  const hero2 = { title: first.title, text: String(art.overview || t("heroText")).slice(0, 300) };
  if (art.backdrop) hero2.image = art.backdrop;
  return hero2;
}
async function section({ tab } = {}) {
  const tabs = SECTION_TABS();
  const chosen = tabs.some((x) => x.id === tab) ? tab : "novedades";
  let rows = [];
  if (chosen === "novedades") {
    rows = [
      await safeRow("nuevos", newEpisodesRow),
      await safeRow("emision", () => rowOf("emision", listingOf("list:emision"), "list:emision")),
      await safeRow("doramas", () => rowOf("doramas", listingOf("list:doramas"), "list:doramas"))
    ];
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
  const hero2 = heroOf(rows);
  if (hero2) answer.hero = hero2;
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
var PREFERENCE = [/mp4upload/i, /voe/i, /streamtape/i, /(mxdrop|mixdrop)/i, /filemoon/i, /doodstream|dood/i, /lulu/i];
var rank = (name) => {
  const i = PREFERENCE.findIndex((re) => re.test(name));
  return i < 0 ? 99 : i;
};
var SERVER_NAMES = { mp4upload: "Mp4Upload", voe: "VOE", streamtape: "StreamTape", mixdrop: "MixDrop", mxdrop: "MixDrop", filemoon: "Filemoon", doodstream: "DoodStream", dood: "DoodStream", lulu: "LuluVdo" };
var prettyName = (name) => {
  const k = Object.keys(SERVER_NAMES).find((x) => new RegExp(x, "i").test(name));
  return k ? SERVER_NAMES[k] : name;
};
function usable(players) {
  return players.filter((p) => rank(p.name) < 99).sort((a, b) => rank(a.name) - rank(b.name)).slice(0, MAX_COPIES);
}
async function openPlayer(player, req, pageUrl, budget) {
  const frame = await req(`${SITE}/reproductor?video=${encodeURIComponent(player.value)}`, { headers: { Referer: pageUrl } });
  if (!frame.ok) return null;
  const embed = parseIframe(await text(frame));
  if (!embed) return null;
  const out = await resolveViaHelper(embed, kino, SITE + "/", budget.captures > 0);
  if (out && out.captured) budget.captures -= 1;
  return out;
}
function streamOf(out, lang, name) {
  return { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...out.headers || {} }, label: `${t(lang)} \xB7 ${prettyName(name)}`, ...out.subtitles ? { subtitles: out.subtitles } : {}, ...out.durationMs ? { durationMs: out.durationMs } : {} };
}
async function resolve(ref) {
  const m = /^(?:(e):([a-z0-9-]+):(\d+)|(m):([a-z0-9-]+)|(c):([a-z0-9-]+):(\d+):([0-9]))$/i.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  if (!await resolverInstalled(kino)) throw kino.error("unavailable", "resolver missing", { userMessage: t("needResolver") });
  const slug = m[2] || m[5] || m[7];
  const only = m[6] ? Number(m[9]) : null;
  const lang = langOf(slug);
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const budget = { captures: MAX_CAPTURES };
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
      const out = await openPlayer(player, req, pageUrl, budget);
      if (!out) {
        failures.push(`${player.name}: no stream`);
        continue;
      }
      const stream = streamOf(out, lang, player.name);
      if (only == null) {
        const others = players.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${slug}:${number}:${j}`, label: `${t(lang)} \xB7 ${prettyName(players[j].name)}` }));
        try {
          browseScreen().notePlayed("d:" + slug);
        } catch (_) {
        }
      }
      return stream;
    } catch (e) {
      failures.push(`${player.name}: ${e && e.message || e}`);
    }
  }
  kino.log("resolve " + baseOf(slug) + " " + number + " failed: " + failures.join("; "));
  throw kino.error("not_found", "no player opened for " + pageUrl, { userMessage: t("noStreams") });
}
var SUPPORT_URL = "https://ko-fi.com/xuperplugins";
function supportNode(device) {
  if (device === "tv") return { type: "QrImage", value: SUPPORT_URL, size: "large", labelText: "Si te gusta mi trabajo, escan\xE9alo y ap\xF3yame", labelTextEn: "If you like my work, scan it and support me" };
  return { type: "ElevatedButton", key: "donate", icon: "heart", labelText: "Si te gusta mi trabajo, ap\xF3yame", labelTextEn: "If you like my work, support me", onPressed: { go: { url: { href: SUPPORT_URL } } } };
}
function installGateView(device) {
  return {
    type: "Scaffold",
    key: "doramasyt-install",
    body: { type: "SingleChildScrollView", key: "installScroll", children: [
      { type: "Column", padding: 24, gap: 16, crossAxisAlignment: "stretch", children: [
        { type: "Text", text: "Necesitas el motor de reproducci\xF3n", textEn: "You need the playback engine", style: "h3" },
        { type: "Text", color: "secondary", text: "DoramasYT reproduce a trav\xE9s de Kino Resolver (gratis). Inst\xE1lalo una vez y sirve para este y para otros plugins de sitios.", textEn: "DoramasYT plays through Kino Resolver (free). Install it once and it works here and in other site plugins." },
        { type: "ElevatedButton", key: "installResolver", labelText: "Instalar Kino Resolver", labelTextEn: "Install Kino Resolver", onPressed: { go: { installPlugin: { repo: RESOLVER_REPO } } } },
        supportNode(device)
      ] }
    ] }
  };
}
var SCREEN_TABS = [
  { id: "novedades", es: "Novedades", en: "What's new" },
  { id: "doramas", es: "Doramas", en: "Dramas" },
  { id: "peliculas", es: "Pel\xEDculas", en: "Movies" },
  { id: "generos", es: "G\xE9neros", en: "Genres" }
];
var browseInstance = null;
var browseScreen = () => browseInstance ?? (browseInstance = makeBrowse({
  kino,
  brand: "DoramasYT",
  tabs: SCREEN_TABS,
  loadTab: async (tabId) => ({ rows: (await section({ tab: tabId })).rows }),
  searchTitles: (q) => search({ q }),
  canPlay: false
}));
async function screen(ctx) {
  await null;
  const c = ctx && typeof ctx === "object" ? ctx : {};
  if (!(c.installed && c.installed[RESOLVER_REPO])) return installGateView(c.device);
  return browseScreen().view(c);
}
async function screenEvent(ev) {
  await null;
  return browseScreen().event(ev && typeof ev === "object" ? ev : {});
}
export {
  action,
  browse,
  categories,
  details,
  episodes,
  home,
  resolve,
  screen,
  screenEvent,
  search,
  section,
  settingsStatus
};
