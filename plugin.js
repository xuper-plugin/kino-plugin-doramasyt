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

// src/std/model.js
var MAX_SLIDES = 5;
var MAX_RAILS = 8;
var MAX_RAIL_ITEMS = 20;
var MAX_SLIDE_TEXT = 160;
var HTTPS = /^https:\/\//;
function cardOf(item) {
  const out = { id: item.id, ref: item.ref, title: item.title, kind: item.kind };
  if (item.poster && HTTPS.test(item.poster)) out.poster = item.poster;
  if (item.backdrop && HTTPS.test(item.backdrop)) out.backdrop = item.backdrop;
  if (item.badges) out.badges = item.badges;
  if (item.rating !== void 0) out.rating = item.rating;
  if (item.year !== void 0) out.year = item.year;
  if (item.ids && item.ids.tmdb) out.ids = { tmdb: item.ids.tmdb };
  if (item.lang) out.lang = item.lang;
  if (item.adult === true) out.adult = true;
  return out;
}
var slidesOf = (rows) => pickSlides(rows, (item) => item.backdrop);
var posterSlidesOf = (rows) => pickSlides(rows, (item) => item.poster);
function slideText(overview, item = {}) {
  const text2 = typeof overview === "string" ? overview.trim() : "";
  if (text2 === "") return [item.year, item.rating ? "\u2605 " + item.rating : null].filter(Boolean).join(" \xB7 ");
  return text2.length <= MAX_SLIDE_TEXT ? text2 : `${text2.slice(0, MAX_SLIDE_TEXT - 1).trimEnd()}\u2026`;
}
function pickSlides(rows, pictureOf) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const item of row.items || []) {
      if (out.length >= MAX_SLIDES) return out;
      const image = pictureOf(item);
      if (item.adult === true || seen.has(item.id) || !image || !HTTPS.test(image)) continue;
      seen.add(item.id);
      out.push({ id: item.id, ref: item.ref, kind: item.kind, title: item.title, image, text: slideText(item.overview, item) });
    }
  }
  return out;
}
var uniform = (items) => items.every((i) => i.backdrop) ? items : items.map(({ backdrop, ...rest }) => rest);
function railsOf(rows) {
  return rows.filter((r) => r.items && r.items.length > 0).slice(0, MAX_RAILS).map((r) => ({
    id: r.id,
    title: r.title,
    ...r.ref ? { ref: r.ref } : {},
    items: uniform(r.items.slice(0, MAX_RAIL_ITEMS).map(cardOf))
  }));
}
function tabOf(page) {
  const rows = page && Array.isArray(page.rows) ? page.rows : [];
  const rails = railsOf(rows);
  if (rails.length === 0) return null;
  return { slides: slidesOf(rows), posterSlides: posterSlidesOf(rows), rails };
}
function playedKey(ref) {
  const m = /^(?:m|s|e):(\d{1,10})(?::|$)/.exec(String(ref || ""));
  return m ? `t:${m[1]}` : String(ref || "");
}
function recentOf(keys, tabs) {
  if (keys.length === 0) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const data of tabs) {
    for (const rail2 of data.rails) {
      for (const card of rail2.items) {
        const ks = [card.ref];
        if (card.ids && card.ids.tmdb) ks.push(`t:${card.ids.tmdb}`);
        for (const k of ks) if (!byKey.has(k)) byKey.set(k, card);
      }
    }
  }
  const out = [];
  const used = /* @__PURE__ */ new Set();
  for (const key of keys) {
    const card = byKey.get(key);
    if (card && !used.has(card.id)) {
      used.add(card.id);
      out.push(card);
    }
  }
  return out;
}

// src/std/strings.js
var WORDS = {
  watch: ["Ver", "Watch"],
  info: ["M\xE1s informaci\xF3n", "More info"],
  recent: ["Continuar viendo", "Continue watching"],
  search: ["Buscar", "Search"],
  searchHint: ["Buscar en {name}", "Search {name}"],
  failed: ["No se pudo cargar esta secci\xF3n. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.", "This section could not be loaded. Check your connection and try again."],
  retry: ["Reintentar", "Retry"],
  empty: ["A\xFAn no hay nada aqu\xED.", "Nothing here yet."],
  back: ["Atr\xE1s", "Back"],
  close: ["Cerrar", "Close"],
  settings: ["Ajustes", "Settings"],
  supportTv: ["Si te gusta mi trabajo, escan\xE9alo y ap\xF3yame", "If you like my work, scan it and support me"],
  support: ["Si te gusta mi trabajo, ap\xF3yame", "If you like my work, support me"],
  gateTitle: ["Necesitas el motor de reproducci\xF3n", "You need the playback engine"],
  gateText: [
    "{name} reproduce a trav\xE9s de Kino Resolver (gratis). Inst\xE1lalo una vez y sirve para este y para otros plugins de sitios.",
    "{name} plays through Kino Resolver (free). Install it once and it works here and in other site plugins."
  ],
  gateInstall: ["Instalar Kino Resolver", "Install Kino Resolver"]
};
var fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? String(vars[k]) : m);
function twin(key, field = "text", vars) {
  const [es, en] = WORDS[key];
  const pick = (i) => vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, Array.isArray(v) ? v[i] : v]));
  return { [field]: fill(es, pick(0)), [field + "En"]: fill(en, pick(1)) };
}
var STRING_KEYS = Object.keys(WORDS);

// src/std/view.js
var SUPPORT_URL = "https://ko-fi.com/xuperplugins";
var RESOLVER_REPO = "xuper-plugin/kino-plugin-kino-resolver";
var POLL_MS = 1500;
function brand(cfg) {
  return {
    type: "Row",
    key: "brand",
    gap: 12,
    crossAxisAlignment: "center",
    children: [
      ...cfg.logo ? [{ type: "Image", key: "logo", url: cfg.logo, aspect: cfg.logoAspect || "1:1", fit: "contain", h: 32, alt: cfg.name, altEn: cfg.nameEn || cfg.name }] : [],
      { type: "Text", key: "name", style: "h4", text: cfg.name, textEn: cfg.nameEn || cfg.name }
    ]
  };
}
var tabBar = (tabs, active) => ({
  type: "TabBar",
  key: "tabs",
  divider: false,
  value: active,
  onChanged: "tab",
  tabs: tabs.map((t2) => ({ value: t2.id, label: t2.label, labelEn: t2.labelEn || t2.label }))
});
var iconButton = (key, icon, word, onPressed) => ({ type: "IconButton", key, icon, ...twin(word, "labelText"), ...twin(word, "tooltip"), onPressed });
var searchOpenOps = (tabsInBar) => [
  { hide: "brand" },
  { hide: "searchButton" },
  { hide: "settingsButton" },
  ...tabsInBar ? [{ hide: "tabs" }] : [],
  { show: "closeSearch" },
  { show: "q" },
  { focus: "q" }
];
var searchClosedOps = (tabsInBar) => [
  { hide: "closeSearch" },
  { hide: "q" },
  { clear: "q" },
  { show: "brand" },
  { show: "searchButton" },
  { show: "settingsButton" },
  ...tabsInBar ? [{ show: "tabs" }] : []
];
function supportNode(device) {
  if (device === "tv") return { type: "QrImage", key: "donate", value: SUPPORT_URL, size: "large", ...twin("supportTv", "labelText") };
  return { type: "ElevatedButton", key: "donate", icon: "heart", ...twin("support", "labelText"), onPressed: { go: { url: { href: SUPPORT_URL } } } };
}
var bar = ({ leading, title, actions = [] }) => ({ type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, leading, title, actions });
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
var heroSkeleton = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var titleOf = (s) => ({ ref: s.ref, kind: s.kind, id: s.id, title: s.title });
var withHeaders = (headers) => headers ? { headers } : {};
var slideNode = (s, headers) => ({
  type: "heroCard",
  key: "slide-" + s.id,
  h: { compact: 200, expanded: 240 },
  ...s.logo ? { logo: s.logo } : {},
  title: s.title,
  text: s.text,
  image: s.image,
  ...withHeaders(headers),
  buttons: [
    { type: "ElevatedButton", key: "watch-" + s.id, ...twin("watch", "labelText"), icon: "play", onPressed: { go: { play: titleOf(s) } } },
    { type: "TextButton", key: "info-" + s.id, ...twin("info", "labelText"), onPressed: { go: { title: titleOf(s) } } }
  ]
});
var hero = (slides, headers) => slides.length === 1 ? slideNode(slides[0], headers) : {
  type: "PageView",
  key: "hero" + slides.length,
  autoPlayMs: 6e3,
  children: slides.map((s) => slideNode(s, headers))
};
var rail = (r, key, words, headers) => ({
  type: "titleRail",
  key,
  ...words || { title: r.title, titleEn: r.titleEn || r.title },
  ...r.ref ? { ref: r.ref } : {},
  items: r.items,
  ...withHeaders(headers)
});
function browseView(cfg, { tab, data, recent, pending, failed, device = "phone" }) {
  const tv = device === "tv";
  const tabs = cfg.tabs;
  const active = tabs.some((t2) => t2.id === tab) ? tab : tabs[0].id;
  const withTabs = tabs.length > 1;
  const body = [];
  if (data) {
    const h = cfg.imageHeaders;
    if (data.slides.length > 0) body.push(hero(data.slides, h));
    if (recent.length > 0) body.push(rail({ items: recent }, "recent", twin("recent", "title"), h));
    for (const r of data.rails) body.push(rail(r, "rail-" + String(r.id).replace(/[^A-Za-z0-9_-]/g, "_"), null, h));
    if (data.rails.length === 0) body.push({ type: "Text", key: "empty", ...twin("empty"), color: "muted" });
  } else if (failed) {
    body.push({ type: "MaterialBanner", key: "loadFailed", role: "error", ...twin("failed"), action: { ...twin("retry", "label"), onTap: "retry" } });
  } else {
    body.push(heroSkeleton(), railSkeleton(1), railSkeleton(2), railSkeleton(3));
  }
  const isBanner = (n) => !!n && (n.type === "heroCard" || n.key === "heroSkeleton" || n.type === "PageView" && String(n.key).startsWith("hero"));
  const banner = body.length > 0 && isBanner(body[0]) ? body.shift() : null;
  const tabsInBar = tv && withTabs;
  const appBar = bar({
    leading: iconButton("close", "close", "close", { go: { close: true } }),
    title: { type: "Row", key: "titleRow", gap: tabsInBar ? 24 : 8, crossAxisAlignment: "center", children: [
      { ...iconButton("closeSearch", "arrow_back", "back", { ui: searchClosedOps(tabsInBar) }), hidden: true },
      brand(cfg),
      ...tabsInBar ? [tabBar(tabs, active)] : [],
      {
        type: "TextField",
        key: "q",
        hidden: true,
        flex: 1,
        kind: "search",
        maxLength: 200,
        ...twin("searchHint", "hintText", { name: [cfg.name, cfg.nameEn || cfg.name] }),
        onSubmitted: "search",
        trailingIcon: "search",
        ...twin("search", "trailingLabel"),
        onTrailingTap: "search"
      }
    ] },
    actions: [
      iconButton("searchButton", "search", "search", { ui: searchOpenOps(tabsInBar) }),
      iconButton("settingsButton", "settings", "settings", "openSettings")
    ]
  });
  return {
    type: "Scaffold",
    appBar,
    body: { type: "Column", key: "page", children: [
      ...withTabs && !tv ? [{ type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(tabs, active)] }] : [],
      { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [...banner ? [banner] : [], { type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] }
    ] },
    ...pending ? { every: { ms: POLL_MS, event: "tick" } } : {}
  };
}
function settingsView(cfg, device = "phone") {
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("back", "arrow_back", "back", "back"), title: brand(cfg) }),
    body: { type: "SingleChildScrollView", key: "settings-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [
      ...cfg.hasSettings ? [{ type: "settings", key: "form" }, { type: "Divider", key: "supportDivider" }] : [],
      supportNode(device)
    ] }] }
  };
}
function gateView(cfg, device = "phone") {
  const name = [cfg.name, cfg.nameEn || cfg.name];
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("close", "close", "close", { go: { close: true } }), title: brand(cfg) }),
    body: { type: "Column", key: "gate", mainAxisAlignment: "center", crossAxisAlignment: "center", padding: 24, gap: 16, children: [
      { type: "Text", key: "gateTitle", style: "h3", ...twin("gateTitle") },
      { type: "Text", key: "gateText", style: "p", ...twin("gateText", "text", { name }) },
      { type: "ElevatedButton", key: "installResolver", ...twin("gateInstall", "labelText"), onPressed: { go: { installPlugin: { repo: RESOLVER_REPO } } } },
      supportNode(device)
    ] }
  };
}

// src/std/metaCache.js
var KEY = "meta3";
var MAX = 160;
var CONCURRENCY = 3;
var OVERVIEW_MAX = 160;
var HTTPS2 = /^https:\/\//;
function makeMetaCache({ kino: kino2, titleOf: titleOf2 = (c) => c.title, typeOf = (c) => c.kind === "series" ? "series" : "movie", tmdbPictures = false, clock = { now: () => Date.now() } }) {
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
    return {
      ...e.t > 0 ? { tmdb: e.t } : {},
      ...e.l && HTTPS2.test(e.l) ? { logo: e.l } : {},
      ...e.p && HTTPS2.test(e.p) ? { poster: e.p } : {},
      ...e.b && HTTPS2.test(e.b) ? { backdrop: e.b } : {},
      ...typeof e.o === "string" && e.o ? { overview: e.o } : {}
    };
  }
  const asked = (id) => Object.hasOwn(read2(), id);
  function dress(cards) {
    return cards.map((c) => {
      const k = known(c.id);
      const poster = tmdbPictures && k.poster ? k.poster : null;
      if (!k.tmdb && !poster) return c;
      return { ...c, ...k.tmdb && !(c.ids && c.ids.tmdb) ? { ids: { ...c.ids || {}, tmdb: k.tmdb } } : {}, ...poster ? { poster } : {} };
    });
  }
  async function fill2(cards, budgetMs) {
    if (!usable2()) return 0;
    const b = read2();
    const end = clock.now() + budgetMs;
    let count = 0;
    let stop = false;
    const seen = /* @__PURE__ */ new Set();
    const todo = cards.filter((c) => {
      if (!c || typeof c.id !== "string" || seen.has(c.id) || Object.hasOwn(b, c.id) || c.ids && c.ids.tmdb && c.noLogo) return false;
      seen.add(c.id);
      return true;
    });
    let next = 0;
    const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
    const worker = async () => {
      while (!stop && next < todo.length && clock.now() < end) {
        const c = todo[next++];
        const year = c.year !== void 0 ? { year: c.year } : {};
        try {
          const a = await kino2.meta({ type: typeOf(c), title: titleOf2(c), ...year });
          b[c.id] = {
            t: a && a.ids && Number.isInteger(a.ids.tmdb) ? a.ids.tmdb : 0,
            l: str(a && a.logo, 2048),
            p: str(a && a.poster, 2048),
            b: str(a && a.backdrop, 2048),
            o: str(a && a.overview, OVERVIEW_MAX)
          };
          count++;
        } catch (e) {
          if (e && e.code === "rate_limited") stop = true;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (count > 0) write2();
    return count;
  }
  return { known, asked, dress, fill: fill2, usable: usable2, tmdbPictures };
}

// src/std/index.js
var TAB_KEY = "browseTab";
var SNAP_PREFIX = "browse1:";
var SNAP_TTL_MS = 7 * 24 * 3600 * 1e3;
var SNAP_MAX = 20 * 1024;
var RECENT_KEY = "recent1";
var RECENT_MAX = 12;
var Q_MAX = 200;
var META_TICK_MS = 3e3;
var MAX_META_TICKS = 10;
var DEFAULT_TABS = [{ id: "inicio", label: "Inicio", labelEn: "Home" }];
function makeStandardScreen({ kino: kino2, name, nameEn, logo = null, logoAspect = "1:1", needsResolver, hasSettings, tabs, loadTab, homeKey = null, titleOf: titleOf2, typeOf, tmdbPictures = false, imageHeaders = null }) {
  const cfg = { name, nameEn, logo, logoAspect, imageHeaders, hasSettings: !!hasSettings, tabs: Array.isArray(tabs) && tabs.length > 0 ? tabs : DEFAULT_TABS };
  const TAB_IDS = cfg.tabs.map((t2) => t2.id);
  const meta = makeMetaCache({ kino: kino2, titleOf: titleOf2, typeOf, tmdbPictures });
  function slidesFromMeta(rails) {
    const out = [];
    for (const r of rails) {
      for (const c of r.items) {
        if (out.length >= MAX_SLIDES) return out;
        const k = meta.known(c.id);
        if (!k.backdrop || c.adult === true || out.some((x) => x.id === c.id)) continue;
        out.push({ id: c.id, ref: c.ref, kind: c.kind, title: c.title, image: k.backdrop, text: slideText(k.overview, c), ...k.logo ? { logo: k.logo } : {} });
      }
    }
    return out;
  }
  const enrich = (data) => {
    if (!data) return data;
    const own = data.slides.map((s) => {
      const k = meta.known(s.id);
      const image = tmdbPictures && k.backdrop ? k.backdrop : null;
      return k.logo || image ? { ...s, ...k.logo ? { logo: k.logo } : {}, ...image ? { image } : {} } : s;
    });
    const learned = own.length > 0 ? [] : slidesFromMeta(data.rails);
    return {
      // The site's own backdrops, else TMDB's, else the posters: every plugin has a hero.
      slides: own.length > 0 ? own : learned.length > 0 ? learned : data.posterSlides || [],
      rails: data.rails.map((r) => ({ ...r, items: meta.dress(r.items) }))
    };
  };
  const metaTicks = /* @__PURE__ */ new Map();
  const memo = /* @__PURE__ */ new Map();
  const log = (...a) => {
    try {
      kino2.log("[std]", ...a);
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
      const slim = { slides: data.slides, posterSlides: data.posterSlides || [], rails: data.rails.map((r) => ({ ...r, items: r.items.slice(0, per) })) };
      const text2 = JSON.stringify({ at: Date.now(), data: slim });
      if (text2.length <= SNAP_MAX) {
        set(SNAP_PREFIX + tab, text2, { ttlMs: SNAP_TTL_MS });
        return;
      }
    }
  }
  function homeSeed(tab) {
    if (!homeKey || tab !== TAB_IDS[0]) return null;
    try {
      const o = JSON.parse(get(homeKey) || "null");
      return o && Array.isArray(o.rows) && o.rows.length ? tabOf({ rows: o.rows }) : null;
    } catch (_) {
      return null;
    }
  }
  const stored = () => {
    const t2 = get(TAB_KEY);
    return TAB_IDS.includes(t2) ? t2 : null;
  };
  function dataOf(tab) {
    if (memo.has(tab)) return memo.get(tab).data;
    const snap = readSnap(tab) || homeSeed(tab);
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
      const key = playedKey(ref);
      if (key === "" || key.startsWith("x|")) return;
      const keys = readKeys();
      if (keys[0] === key) return;
      set(RECENT_KEY, JSON.stringify([key, ...keys.filter((k) => k !== key)].slice(0, RECENT_MAX)));
    } catch (_) {
    }
  }
  const tabFromArgs = (route) => {
    const a = route && route.args && typeof route.args === "object" ? route.args : {};
    return TAB_IDS.includes(a.tab) ? a.tab : null;
  };
  function needed(tab) {
    return memo.get(tab) && memo.get(tab).whole ? [] : [tab];
  }
  function screen2(ctx) {
    const c = ctx || {};
    const device = c.device || "phone";
    if (needsResolver && !(c.installed && c.installed[RESOLVER_REPO])) return gateView(cfg, device);
    if (c.route && c.route.name === "settings") return settingsView(cfg, device);
    const st = c.state && typeof c.state === "object" ? c.state : {};
    const tab = TAB_IDS.includes(st.tab) ? st.tab : tabFromArgs(c.route) ?? stored() ?? TAB_IDS[0];
    const data = enrich(dataOf(tab));
    const loaded = TAB_IDS.map((t2) => memo.get(t2)).filter(Boolean).map((m) => m.data);
    const pending = Array.isArray(st.pending) && st.pending.length > 0;
    return browseView(cfg, { tab, data, recent: meta.dress(recentOf(readKeys(), loaded)), pending, failed: !!(st.failed && st.failed[tab]), device });
  }
  async function load(tab) {
    const data = tabOf(await loadTab(tab));
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
      return { state: { tab, pending: needed(tab), failed: null } };
    },
    tab({ value, arg, state }) {
      const tab = TAB_IDS.includes(value) ? value : TAB_IDS.includes(arg) ? arg : null;
      if (!tab) return null;
      set(TAB_KEY, tab);
      dataOf(tab);
      const failed = { ...state.failed || {} };
      delete failed[tab];
      const pending = [tab, ...Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : []];
      return { state: { tab, pending: memo.get(tab) && memo.get(tab).whole ? pending.slice(1) : pending, failed } };
    },
    retry({ state }) {
      const tab = TAB_IDS.includes(state.tab) ? state.tab : TAB_IDS[0];
      return { state: { failed: null, pending: [tab] } };
    },
    async tick({ state }) {
      const pending = Array.isArray(state.pending) ? state.pending : [];
      if (pending.length === 0) return null;
      const [next, ...rest] = pending;
      const failed = { ...state.failed || {} };
      if (next.startsWith("meta:")) {
        const tab = next.slice(5);
        const m = memo.get(tab);
        if (!m) return { state: { pending: rest } };
        const ask = (x) => ({ id: x.id, title: x.title, kind: x.kind, ...x.year !== void 0 ? { year: x.year } : {} });
        const noOwnSlides = m.data.slides.length === 0;
        const cards = [...m.data.slides.map(ask), ...m.data.rails.flatMap((r) => r.items.slice(0, noOwnSlides ? MAX_SLIDES * 3 : 6).map(ask))];
        const count = await meta.fill(cards, META_TICK_MS);
        const ticks = (metaTicks.get(tab) || 0) + 1;
        metaTicks.set(tab, ticks);
        const again = noOwnSlides && count > 0 && ticks < MAX_META_TICKS && slidesFromMeta(m.data.rails).length < MAX_SLIDES && cards.some((c) => !meta.asked(c.id));
        return { state: { pending: again ? [next, ...rest] : rest } };
      }
      try {
        const ok = await load(next);
        if (!ok) failed[next] = true;
        else delete failed[next];
        if (ok && meta.usable()) rest.unshift("meta:" + next);
      } catch (e) {
        log("tab", e && e.code || "error");
        failed[next] = true;
      }
      return { state: { pending: rest, failed } };
    },
    // The words go to Kino's own search, with this plugin as the source; the bar is put back as it was, locally.
    search({ value, state, device }) {
      const typed = value && typeof value === "object" ? value.q : value;
      const raw = typed != null && String(typed).trim() !== "" ? typed : state.inputs && state.inputs.q;
      const q = String(raw == null ? "" : raw).trim().slice(0, Q_MAX);
      return q ? { go: { search: { q } }, ui: searchClosedOps(device === "tv" && TAB_IDS.length > 1) } : null;
    },
    openSettings() {
      return { route: { push: "settings" }, state: { fromBrowse: true } };
    },
    back({ state, route }) {
      if (route && route.name === "settings" && !state.fromBrowse) return { close: true };
      return { route: { pop: true }, state: { fromBrowse: false } };
    }
  };
  async function screenEvent2(ev) {
    const e = ev || {};
    const name2 = e.name != null ? e.name : e.event;
    const handler = typeof name2 === "string" && Object.hasOwn(events, name2) ? events[name2] : null;
    return handler ? await handler({ ...e, state: e.state || {} }) ?? null : null;
  }
  return { screen: screen2, screenEvent: screenEvent2, notePlayed };
}

// src/logo.js
var LOGO = "data:image/png;base64,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";
var LOGO_ASPECT = "1:1";

// src/resolve-door.js
var HLS_MIME = "application/vnd.apple.mpegurl";
var RESOLVER_ALIAS = "resolver";
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
  const dead = !streams.length && res && res.error === "dead";
  if (!streams.length && !dead && (typeof allowCapture === "function" ? allowCapture() : allowCapture)) {
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
  if (art.backdrop && !item.backdrop) item.backdrop = art.backdrop;
  if (art.year && !item.year) item.year = art.year;
  if (art.rating && !item.rating) item.rating = art.rating;
  if (art.overview && !item.overview) item.overview = art.overview;
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
var CAPTURE_PAGE_MS = 23e3;
function takeCapture(budget) {
  if (!budget || budget.captures <= 0 || budget.deadline - Date.now() < CAPTURE_PAGE_MS) return false;
  budget.captures -= 1;
  return true;
}
var CACHE_MS = 10 * 60 * 1e3;
var YEAR = (/* @__PURE__ */ new Date()).getUTCFullYear();
var STATS_KEY = "srvStats";
var STATS_CAP = 24;
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
    estrenos: "Estrenos",
    liveAction: "Live Action",
    moviesNew: "Pel\xEDculas nuevas",
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
    estrenos: "New releases",
    liveAction: "Live Action",
    moviesNew: "New movies",
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
  estrenos: { path: `/doramas?fecha=${YEAR}`, titleKey: "estrenos", kind: "series" },
  doramas: { path: "/doramas", titleKey: "dramas", kind: "series" },
  liveaction: { path: "/doramas?categoria=live-action", titleKey: "liveAction", kind: "series" },
  peliculas: { path: "/doramas?categoria=pelicula", titleKey: "movies", kind: "movie" },
  pelisnew: { path: `/doramas?categoria=pelicula&fecha=${YEAR}`, titleKey: "moviesNew", kind: "movie" }
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
var listRow = (name) => safeRow(name, () => rowOf(name, listingOf("list:" + name), "list:" + name));
var genreRow = (g) => safeRow("genre-" + g.slug, () => rowOf("genre-" + g.slug, listingOf("genre:" + g.slug), "genre:" + g.slug));
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
    () => listRow("estrenos"),
    () => listRow("emision"),
    () => listRow("doramas"),
    () => listRow("peliculas")
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
    rows = await Promise.all([safeRow("nuevos", newEpisodesRow), listRow("estrenos"), listRow("emision"), listRow("doramas"), listRow("peliculas")]);
  } else if (chosen === "doramas") {
    rows = await Promise.all([listRow("doramas"), ...GENRES.slice(0, 4).map(genreRow), listRow("liveaction")]);
  } else if (chosen === "peliculas") {
    const d = listingOf("list:peliculas");
    rows = await Promise.all([
      listRow("peliculas"),
      listRow("pelisnew"),
      safeRow("peliculas2", async () => {
        const items = byAudio(await listing(d, 2)).map((c) => toItem(c, "movie"));
        return items.length ? { id: "peliculas2", title: t("moreMovies"), items, genre: "peliculas" } : null;
      })
    ]);
  } else {
    rows = await Promise.all(GENRES.slice(4).map(genreRow));
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
function readStats() {
  try {
    const o = JSON.parse(kino.storage.get(STATS_KEY) || "{}");
    return o && typeof o === "object" ? o : {};
  } catch (_) {
    return {};
  }
}
var statKey = (name) => String(prettyName(name) || name || "").toLowerCase();
function scoreOf(name, stats) {
  const s = stats[statKey(name)] || { ok: 0, fail: 0 };
  return (s.ok + 1) / (s.ok + s.fail + 2);
}
function noteServer(name, ok) {
  try {
    const stats = readStats();
    const k = statKey(name);
    const s = stats[k] || { ok: 0, fail: 0 };
    s[ok ? "ok" : "fail"] += 1;
    if (s.ok + s.fail > STATS_CAP) {
      s.ok = Math.round(s.ok / 2);
      s.fail = Math.round(s.fail / 2);
    }
    stats[k] = s;
    kino.storage.set(STATS_KEY, JSON.stringify(stats));
  } catch (_) {
  }
}
function usable(players) {
  return [...players].sort((a, b) => rank(a.name) - rank(b.name)).slice(0, MAX_COPIES);
}
async function openPlayer(player, req, pageUrl, budget) {
  const frame = await req(`${SITE}/reproductor?video=${encodeURIComponent(player.value)}`, { headers: { Referer: pageUrl } });
  if (!frame.ok) return null;
  const embed = parseIframe(await text(frame));
  if (!embed) return null;
  const out = await resolveViaHelper(embed, kino, SITE + "/", () => takeCapture(budget));
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
  const budget = { captures: MAX_CAPTURES, deadline: Date.now() + RESOLVE_MS };
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
  const stats = readStats();
  const order = only != null ? [only] : players.map((_, i) => i).sort((a, b) => scoreOf(players[b].name, stats) - scoreOf(players[a].name, stats));
  const failures = [];
  for (const i of order) {
    const player = players[i];
    if (!player) continue;
    try {
      const out = await openPlayer(player, req, pageUrl, budget);
      if (!out) {
        failures.push(`${player.name}: no stream`);
        noteServer(player.name, false);
        continue;
      }
      noteServer(player.name, true);
      const stream = streamOf(out, lang, player.name);
      if (only == null) {
        const others = players.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${slug}:${number}:${j}`, label: `${t(lang)} \xB7 ${prettyName(players[j].name)}` }));
        try {
          standard().notePlayed("d:" + slug);
        } catch (_) {
        }
      }
      return stream;
    } catch (e) {
      failures.push(`${player.name}: ${e && e.message || e}`);
      noteServer(player.name, false);
    }
  }
  kino.log("resolve " + baseOf(slug) + " " + number + " failed: " + failures.join("; "));
  throw kino.error("not_found", "no player opened for " + pageUrl, { userMessage: t("noStreams") });
}
var std = null;
var standard = () => std ?? (std = makeStandardScreen({
  kino,
  name: "DoramasYT",
  logo: LOGO,
  logoAspect: LOGO_ASPECT,
  needsResolver: true,
  hasSettings: true,
  tabs: [
    { id: "novedades", label: "Novedades", labelEn: "What's new" },
    { id: "doramas", label: "Doramas", labelEn: "Dramas" },
    { id: "peliculas", label: "Pel\xEDculas", labelEn: "Movies" },
    { id: "generos", label: "G\xE9neros", labelEn: "Genres" }
  ],
  loadTab: async (tabId) => ({ rows: (await section({ tab: tabId })).rows })
}));
async function screen(ctx) {
  await null;
  return standard().screen(ctx && typeof ctx === "object" ? ctx : {});
}
async function screenEvent(ev) {
  await null;
  return standard().screenEvent(ev && typeof ev === "object" ? ev : {});
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
