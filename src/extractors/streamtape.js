import { miss, pageText } from "./shared.js";

export const HOSTS = ["streamtape.com", "streamtape.to", "streamtape.net", "streamta.pe", "strtape.cloud", "strcloud.link", "stape.fun", "streamadblocker.xyz"];

// The page writes the address with string arithmetic:  innerHTML = '//strea' + ('xcdmtape.com/get_video?id=..&token=..').substring(2).substring(1)
// Several such lines exist (two of them are decoys with another prefix); the `robotlink` ones carry the real address.
const LINE = /getElementById\(\s*['"](robotlink|norobotlink|ideoolink|botlink)['"]\s*\)\.innerHTML\s*=\s*(["'])([^"']*)\2\s*\+\s*(?:''\s*\+\s*)?\(\s*(["'])([^"']*)\4\s*\)((?:\s*\.substring\(\s*\d+\s*\))+)/g;

/** The address a page's lines spell out, or null. Exported for the tests. */
export function addressOf(html) {
  const found = [];
  for (const m of String(html || "").matchAll(LINE)) {
    let tail = m[5];
    for (const [, n] of m[6].matchAll(/\.substring\(\s*(\d+)\s*\)/g)) tail = tail.substring(Number(n));
    found.push({ id: m[1], url: m[3] + tail });
  }
  const pick = found.filter((f) => /get_video\?/.test(f.url) && /token=/.test(f.url));
  const best = pick.find((f) => f.id === "robotlink") || pick.find((f) => f.id === "norobotlink") || pick[pick.length - 1];
  return best ? (best.url.startsWith("//") ? "https:" + best.url : best.url) : null;
}

export async function extract(embedUrl, req, kino) {
  const html = await pageText(req, embedUrl, { Referer: "https://www.doramasyt.com/" }, kino, "streamtape");
  if (html == null) return null;
  const url = addressOf(html);
  if (!url) return miss(kino, "streamtape", "no address in page");
  return { url, mime: "video/mp4", headers: { Referer: new URL(embedUrl).origin + "/" } };
}
