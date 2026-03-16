const form = document.getElementById("scrape-form");
const sourcesList = document.getElementById("sources-list");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");
const resultSection = document.getElementById("result");
const resultMeta = document.getElementById("result-meta");
const resultPreview = document.getElementById("result-preview");
const downloadLink = document.getElementById("downloadLink");
let pollTimer = null;

function setStatus(message, tone = "info") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function setLoading(isLoading) {
  statusEl.classList.toggle("loading", Boolean(isLoading));
}

async function loadSources() {
  const res = await fetch("/api/sources");
  const data = await res.json();
  sourcesList.innerHTML = "";

  data.sources.forEach((source, index) => {
    const wrapper = document.createElement("label");
    wrapper.className = "source-item";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "source";
    radio.value = source.id;
    radio.checked = index === 0;

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = source.label;
    const desc = document.createElement("span");
    desc.textContent = source.description || "";

    content.appendChild(title);
    content.appendChild(desc);
    wrapper.appendChild(radio);
    wrapper.appendChild(content);
    sourcesList.appendChild(wrapper);
  });
}

function getSelectedSources() {
  const selected = document.querySelector("input[name=\"source\"]:checked");
  return selected ? [selected.value] : [];
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

function renderResult(result) {
  const formatLabel = result.format === "csv"
    ? (result.formatLabel || "CSV")
    : "JSON";

  resultSection.classList.remove("hidden");
  resultMeta.textContent = `Tổng cộng ${result.count} bài viết. Nguồn: ${result.meta.sources.join(", ")}. Định dạng: ${formatLabel}.`;
  resultPreview.textContent = formatPreview(result.items, result.format);

  const binaryString = window.atob(result.fileContentBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const mimeType = result.format === "csv" ? "text/csv" : "application/json";
  const blob = new Blob([bytes], { type: mimeType });
  const fileUrl = URL.createObjectURL(blob);

  downloadLink.href = fileUrl;
  downloadLink.download = result.fileName;
  downloadLink.textContent = result.format === "csv" ? `Tải ${formatLabel}` : "Tải JSON";
}

async function pollJob(jobId) {
  const statusRes = await fetch(`/api/scrape-status?jobId=${encodeURIComponent(jobId)}`);
  const statusPayload = await statusRes.json();
  if (!statusRes.ok) {
    throw new Error(statusPayload.error || `Lỗi máy chủ (${statusRes.status}).`);
  }

  if (statusPayload.status === "running") {
    setStatus(`Đang cào: ${statusPayload.count} bài...`, "info");
    return false;
  }

  if (statusPayload.status === "error") {
    setLoading(false);
    throw new Error(statusPayload.error || "Đã xảy ra lỗi.");
  }

  if (statusPayload.status === "done") {
    renderResult(statusPayload.result);
    setStatus("Hoàn tất!", "success");
    setLoading(false);
    return true;
  }

  return false;
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

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  submitBtn.disabled = true;
  setStatus("Đang cào: 0 bài...", "info");
  setLoading(true);

  try {
    const res = await fetch("/api/scrape-start", {
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
      throw new Error(payload.error || `Lỗi máy chủ (${res.status}).`);
    }

    const jobId = payload.jobId;
    const done = await pollJob(jobId);
    if (done) {
      submitBtn.disabled = false;
      setLoading(false);
      return;
    }

    pollTimer = setInterval(() => {
      pollJob(jobId)
        .then((isDone) => {
          if (isDone) {
            clearInterval(pollTimer);
            pollTimer = null;
            submitBtn.disabled = false;
            setLoading(false);
          }
        })
        .catch((error) => {
          clearInterval(pollTimer);
          pollTimer = null;
          setStatus(error.message, "error");
          submitBtn.disabled = false;
          setLoading(false);
        });
    }, 1000);
  } catch (error) {
    setStatus(error.message, "error");
    submitBtn.disabled = false;
    setLoading(false);
  }
});

loadSources().catch(() => {
  setStatus("Không tải được danh sách nguồn.", "error");
  setLoading(false);
});
