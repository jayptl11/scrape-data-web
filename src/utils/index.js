function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function keywordMatches(fields, keyword) {
  const kw = normalizeText(keyword).trim();
  if (!kw) return true;
  return fields.some((field) => normalizeText(field).includes(kw));
}

function parseDateInput(dateStr, endOfDay) {
  if (!dateStr) return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return NaN;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return NaN;
  return Date.UTC(
    year,
    month,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
}

function parseDateRange(startDate, endDate) {
  const startMs = parseDateInput(startDate, false);
  const endMs = parseDateInput(endDate, true);
  return { startMs, endMs };
}

function sanitizeFilename(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "query";
}

module.exports = {
  normalizeText,
  keywordMatches,
  parseDateRange,
  sanitizeFilename
};
