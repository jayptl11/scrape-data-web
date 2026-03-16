const path = require("path");
const express = require("express");
const iconv = require("iconv-lite");
const { sources, getSourceOptions } = require("./src/sources");
const { parseDateRange, sanitizeFilename } = require("./src/utils");

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, "output");
const EXPORT_FIELDS = ["title", "date", "summary", "url"];
const CSV_DELIMITER = ";";

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const needsQuote = str.includes(CSV_DELIMITER) || /["\n\r]/.test(str);
  if (needsQuote) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(items) {
  const rows = [`sep=${CSV_DELIMITER}`, EXPORT_FIELDS.join(CSV_DELIMITER)];
  for (const item of items) {
    rows.push(EXPORT_FIELDS.map((field) => escapeCsv(item[field])).join(CSV_DELIMITER));
  }
  return rows.join("\r\n");
}

function encodeCsv(csvText, encoding) {
  if (encoding === "utf8-bom") {
    return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csvText, "utf8")]);
  }
  if (encoding === "utf16le-bom") {
    return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csvText, "utf16le")]);
  }
  if (encoding === "windows-1258") {
    return iconv.encode(csvText, "windows-1258");
  }
  return Buffer.from(csvText, "utf8");
}

function pickExportFields(item) {
  const picked = {};
  for (const field of EXPORT_FIELDS) {
    picked[field] = item[field] ?? "";
  }
  return picked;
}

app.use(express.json({ limit: "1mb" }));
app.use("/output", express.static(OUTPUT_DIR));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/sources", (req, res) => {
  res.json({ sources: getSourceOptions() });
});

app.post("/api/scrape", async (req, res) => {
  try {
    const { sources: sourceIds, keyword, startDate, endDate, maxItems, format } = req.body || {};

    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({ error: "Vui lòng chọn ít nhất một nguồn." });
    }
    if (sourceIds.length > 1) {
      return res.status(400).json({ error: "Vui lòng chỉ chọn một nguồn mỗi lần." });
    }

    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ error: "Vui lòng nhập từ khóa." });
    }

    const { startMs, endMs } = parseDateRange(startDate, endDate);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
      return res.status(400).json({ error: "Ngày bắt đầu/kết thúc không hợp lệ." });
    }

    const uniqueSources = [...new Set(sourceIds)].filter((id) => sources[id]);
    if (uniqueSources.length === 0) {
      return res.status(400).json({ error: "Nguồn không hợp lệ." });
    }

    const perSourceLimit = Number.isFinite(Number(maxItems)) && Number(maxItems) > 0
      ? Number(maxItems)
      : null;

    const collected = [];

    for (const sourceId of uniqueSources) {
      const source = sources[sourceId];
      const items = await source.search({
        keyword: keyword.trim(),
        startMs,
        endMs,
        maxItems: perSourceLimit
      });
      collected.push(...items);
    }

    collected.sort((a, b) => new Date(b.date) - new Date(a.date));

    const formatKey = (format || "csv").toLowerCase();
    const outputFormat = formatKey === "json" ? "json" : "csv";
    let csvEncoding = "utf8-bom";
    let formatLabel = "CSV (UTF-8)";

    if (outputFormat === "csv") {
      if (formatKey === "csv-utf16") {
        csvEncoding = "utf16le-bom";
        formatLabel = "CSV (UTF-16LE)";
      } else if (formatKey === "csv") {
        csvEncoding = "windows-1258";
        formatLabel = "CSV (Excel ANSI)";
      } else if (formatKey === "csv-utf8") {
        csvEncoding = "utf8-bom";
        formatLabel = "CSV (UTF-8)";
      }
    }
    const exportItems = collected.map(pickExportFields);

    const meta = {
      keyword: keyword.trim(),
      startDate,
      endDate,
      sources: uniqueSources,
      generatedAt: new Date().toISOString(),
      totalItems: exportItems.length,
      format: outputFormat,
      formatLabel
    };

    const safeKeyword = sanitizeFilename(keyword.trim());
    const safeSourcesLabel = sanitizeFilename(uniqueSources.join("-"));
    const safeRange = sanitizeFilename(`${startDate || "start"}-${endDate || "end"}`);
    const fileExt = outputFormat === "json" ? "json" : "csv";
    const fileName = `${safeKeyword}_${safeSourcesLabel}_${safeRange}.${fileExt}`;

    let fileBuffer;
    if (outputFormat === "csv") {
      const csv = toCsv(exportItems);
      fileBuffer = encodeCsv(csv, csvEncoding);
    } else {
      const payload = { meta, items: exportItems };
      fileBuffer = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
    }

    res.json({
      meta,
      count: exportItems.length,
      items: exportItems,
      format: outputFormat,
      formatLabel,
      fileContentBase64: fileBuffer.toString("base64"),
      fileName
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi." });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
