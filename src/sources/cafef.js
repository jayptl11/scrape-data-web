const { keywordMatches } = require("../utils");

const BASE_URL = "https://cafef.vn";

function toAbsoluteUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return BASE_URL + url;
}

function stripTags(value) {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(value) {
  if (!value) return "";
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function extractItemsFromSearch(html) {
  const items = [];
  const matches = Array.from(html.matchAll(/<div class="item"[^>]*>/gi));
  if (matches.length === 0) return items;

  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    const block = html.slice(start, end);

    const linkMatch = block.match(/<a[^>]*class="box-category-link-title"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const linkTag = linkMatch[0];
    const hrefMatch = linkTag.match(/href="([^"]+)"/i);
    const href = hrefMatch ? hrefMatch[1] : "";
    const titleAttrMatch = linkTag.match(/title="([^"]+)"/i);
    const titleRaw = titleAttrMatch ? titleAttrMatch[1] : linkMatch[1];
    const title = decodeEntities(stripTags(titleRaw));

    const sapoMatch = block.match(/<p class="sapo"[^>]*>([\s\S]*?)<\/p>/i);
    const summary = sapoMatch ? decodeEntities(stripTags(sapoMatch[1])) : "";

    items.push({
      title,
      summary,
      url: toAbsoluteUrl(href)
    });
  }

  return items;
}

function parsePublishTime(html) {
  const metaMatch = html.match(/property="article:published_time"\s*content="([^"]+)"/i);
  if (metaMatch) return metaMatch[1];

  const jsonMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (jsonMatch) return jsonMatch[1];

  return "";
}

function parseDateToMs(value) {
  if (!value) return NaN;
  if (/Z$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value)) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : NaN;
  }
  const ms = Date.parse(`${value}+07:00`);
  return Number.isFinite(ms) ? ms : NaN;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0"
    }
  });
  if (!response.ok) {
    throw new Error(`CafeF request failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchArticleDate(url) {
  const html = await fetchText(url);
  const timeValue = parsePublishTime(html);
  const publishMs = parseDateToMs(timeValue);
  return Number.isFinite(publishMs) ? publishMs : NaN;
}

async function search({ keyword, startMs, endMs, maxItems }) {
  if (typeof fetch !== "function") {
    throw new Error("Fetch API is not available. Please use Node.js 18+.");
  }

  const items = [];
  const seen = new Set();
  let page = 1;
  let safety = 0;

  while (true) {
    const pageUrl = page === 1
      ? `${BASE_URL}/tim-kiem.chn?keywords=${encodeURIComponent(keyword)}`
      : `${BASE_URL}/tim-kiem/trang-${page}.chn?keywords=${encodeURIComponent(keyword)}`;

    const html = await fetchText(pageUrl);
    const pageItems = extractItemsFromSearch(html);

    if (pageItems.length === 0) break;

    let pageOldest = Infinity;
    let pageNewest = 0;
    let hasDate = false;

    for (const item of pageItems) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);

      const publishMs = await fetchArticleDate(item.url);
      if (!Number.isFinite(publishMs)) continue;

      hasDate = true;
      pageOldest = Math.min(pageOldest, publishMs);
      pageNewest = Math.max(pageNewest, publishMs);

      if (publishMs < startMs || publishMs > endMs) {
        continue;
      }

      if (!keywordMatches([item.title, item.summary], keyword)) {
        continue;
      }

      items.push({
        title: item.title,
        date: new Date(publishMs).toISOString(),
        summary: item.summary,
        url: item.url,
        source: "cafef"
      });

      if (maxItems && items.length >= maxItems) {
        return items;
      }
    }

    if (hasDate && pageNewest < startMs) {
      break;
    }

    page += 1;
    safety += 1;
    if (safety > 500) break;
  }

  return items;
}

module.exports = {
  id: "cafef",
  label: "CafeF",
  description: "Tin tức CafeF",
  search
};
