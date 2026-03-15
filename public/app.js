const form = document.getElementById("scrape-form");
const sourcesList = document.getElementById("sources-list");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");
const resultSection = document.getElementById("result");
const resultMeta = document.getElementById("result-meta");
const resultPreview = document.getElementById("result-preview");
const downloadLink = document.getElementById("downloadLink");

function setStatus(message, tone = "info") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

async function loadSources() {
  const res = await fetch("/api/sources");
  const data = await res.json();
  sourcesList.innerHTML = "";

  data.sources.forEach((source, index) => {
    const wrapper = document.createElement("label");
    wrapper.className = "source-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "sources";
    checkbox.value = source.id;
    checkbox.checked = index === 0;

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = source.label;
    const desc = document.createElement("span");
    desc.textContent = source.description || "";

    content.appendChild(title);
    content.appendChild(desc);
    wrapper.appendChild(checkbox);
    wrapper.appendChild(content);
    sourcesList.appendChild(wrapper);
  });
}

function getSelectedSources() {
  return Array.from(document.querySelectorAll("input[name=\"sources\"]:checked")).map(
    (input) => input.value
  );
}

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatPreview(items, format) {
  const preview = items.slice(0, 5);
  if (format === "csv") {
    const headers = ["title", "date", "summary", "url"];
    const delimiter = ";";
    const rows = [`sep=${delimiter}`, headers.join(delimiter)];
    preview.forEach((item) => {
      rows.push(headers.map((field) => escapeCsv(item[field])).join(delimiter));
    });
    return rows.join("\n");
  }
  return JSON.stringify(preview, null, 2);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const keyword = document.getElementById("keyword").value.trim();
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const maxItems = document.getElementById("maxItems").value;
  const format = document.getElementById("format").value;
  const sources = getSelectedSources();

  if (!sources.length) {
    setStatus("Bạn cần chọn ít nhất một nguồn.", "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("Đang cào dữ liệu...", "info");

  try {
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sources,
        keyword,
        startDate,
        endDate,
        maxItems: maxItems ? Number(maxItems) : null,
        format
      })
    });

    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.error || "Lỗi không xác định.");
    }

    const formatLabel = payload.format === "csv"
      ? (payload.formatLabel || "CSV")
      : "JSON";

    resultSection.classList.remove("hidden");
    resultMeta.textContent = `Tổng cộng ${payload.count} bài viết. Nguồn: ${payload.meta.sources.join(", ")}. Định dạng: ${formatLabel}.`;
    resultPreview.textContent = formatPreview(payload.items, payload.format);

    const binaryString = window.atob(payload.fileContentBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const mimeType = payload.format === "csv" ? "text/csv" : "application/json";
    const blob = new Blob([bytes], { type: mimeType });
    const fileUrl = URL.createObjectURL(blob);

    downloadLink.href = fileUrl;
    downloadLink.download = payload.fileName;
    downloadLink.textContent = payload.format === "csv" ? `Tải ${formatLabel}` : "Tải JSON";

    setStatus("Hoàn tất!", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

loadSources().catch(() => {
  setStatus("Không tải được danh sách nguồn.", "error");
});
