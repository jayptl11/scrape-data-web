const { keywordMatches } = require("../utils");

const BASE_API = "https://dc.vietstock.vn/api/Search/SearchArticleNewAsync";
const SITE_BASE = "https://vietstock.vn";

function toAbsoluteUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return SITE_BASE + url;
}

function parsePublishTime(row) {
  if (row.PublishTime) {
    const ms = Date.parse(row.PublishTime);
    if (Number.isFinite(ms)) return ms;
  }
  if (row.PublishTimeSource) {
    const ms = Date.parse(row.PublishTimeSource);
    if (Number.isFinite(ms)) return ms;
  }
  return NaN;
}

async function search({ keyword, startMs, endMs, maxItems, pageSize = 50, onProgress }) {
  if (typeof fetch !== "function") {
    throw new Error("Fetch API is not available. Please use Node.js 18+.");
  }

  const items = [];
  let currentPage = 1;
  let skip = 0;
  let safety = 0;

  while (true) {
    const url = `${BASE_API}?keySearch=${encodeURIComponent(keyword)}&currentPage=${currentPage}&pageSize=${pageSize}&skip=${skip}&filterTime=all`;
    const body = {
      keySearch: keyword,
      currentPage,
      pageSize,
      skip,
      filterTime: "all"
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Vietstock search failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const data = Array.isArray(payload?.data) ? payload.data : [];

    if (data.length === 0) break;

    let allBeforeStart = true;

    for (const row of data) {
      const publishMs = parsePublishTime(row);
      if (!Number.isFinite(publishMs)) continue;

      if (publishMs >= startMs) {
        allBeforeStart = false;
      }

      if (publishMs < startMs || publishMs > endMs) {
        continue;
      }

      const title = row.Title || "";
      const summary = row.Head || "";
      const urlAbsolute = toAbsoluteUrl(row.URL);

      if (!keywordMatches([title, summary, row.Tag, row.KeySearch], keyword)) {
        continue;
      }

      items.push({
        title,
        date: new Date(publishMs).toISOString(),
        summary,
        url: urlAbsolute,
        source: "vietstock"
      });
      if (typeof onProgress === "function") {
        onProgress(1);
      }

      if (maxItems && items.length >= maxItems) {
        return items;
      }
    }

    skip = Number.isFinite(payload?.nextSkip) ? payload.nextSkip : currentPage * pageSize;
    currentPage += 1;

    if (Number.isFinite(payload?.totalCount) && skip >= payload.totalCount) {
      break;
    }

    if (allBeforeStart) {
      break;
    }

    safety += 1;
    if (safety > 2000) {
      break;
    }
  }

  return items;
}

module.exports = {
  id: "vietstock",
  label: "Vietstock",
  description: "Tin tức Vietstock",
  search
};
