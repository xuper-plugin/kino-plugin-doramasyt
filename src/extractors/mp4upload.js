import { miss, pageText, absolute } from "./shared.js";

export const HOSTS = ["mp4upload.com"];

// The page holds `player.src({ type: "video/mp4", src: "https://aN.mp4upload.com:183/d/<token>/video.mp4" })`; the file answers only with the embed as Referer.
export async function extract(embedUrl, req, kino) {
  const html = await pageText(req, embedUrl, { Referer: "https://www.mp4upload.com/" }, kino, "mp4upload");
  if (html == null) return null;
  const m = /player\.src\(\s*\{[^}]*?\bsrc\s*:\s*["']([^"']+)["']/.exec(html) || /\bsrc\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/.exec(html);
  const url = m && absolute(m[1], embedUrl);
  if (!url) return miss(kino, "mp4upload", "no file in page");
  return { url, mime: "video/mp4", headers: { Referer: new URL(embedUrl).origin + "/" } };
}
