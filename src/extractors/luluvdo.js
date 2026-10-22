import { miss, pageText, findIn, fileM3u8, HLS_MIME, pageExtras } from "./shared.js";

export const HOSTS = ["luluvdo.com", "lulustream.com"];

// A JW Player page whose script is packed: `file:"https://cdnN.../hls2/.../master.m3u8?t=..."`.
export async function extract(embedUrl, req, kino) {
  const html = await pageText(req, embedUrl, { Referer: "https://www.doramasyt.com/" }, kino, "luluvdo");
  if (html == null) return null;
  const url = findIn(html, (t) => fileM3u8(t, embedUrl));
  if (!url) return miss(kino, "luluvdo", "no playlist in page");
  return { url, mime: HLS_MIME, headers: { Referer: new URL(embedUrl).origin + "/" }, ...pageExtras(html, embedUrl) };
}
