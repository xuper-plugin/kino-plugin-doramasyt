import { miss, pageText, findIn, absolute } from "./shared.js";

export const HOSTS = ["mxdrop.click", "mixdrop.top", "mixdrop.to", "mixdrop.co", "mixdrop.ag", "mixdrop.ch", "mixdrop.ps", "mixdrop.sx", "mixdrop.bz", "mxdrop.to"];

// The packed script sets `MDCore.wurl="//a-deliveryN.mxcontent.net/v2/<id>.mp4?s=...&e=...&_t=..."`.
export async function extract(embedUrl, req, kino) {
  const html = await pageText(req, embedUrl, { Referer: "https://www.doramasyt.com/" }, kino, "mixdrop");
  if (html == null) return null;
  const raw = findIn(html, (t) => (/MDCore\.wurl\s*=\s*["']([^"']+)["']/.exec(t) || [])[1]);
  const url = raw && absolute(raw.startsWith("//") ? "https:" + raw : raw, embedUrl);
  if (!url) return miss(kino, "mixdrop", "no file in page");
  return { url, mime: "video/mp4", headers: { Referer: new URL(embedUrl).origin + "/" } };
}
