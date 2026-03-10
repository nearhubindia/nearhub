const scrapeBtn = document.getElementById("scrapeBtn");
const exportBtn = document.getElementById("exportBtn");
const exportExcelBtn = document.getElementById("exportExcelBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const countEl = document.getElementById("count");
const maxCountInput = document.getElementById("maxCount");
const excelPathInput = document.getElementById("excelPath");
const STORAGE_KEY = "mapsExtractorData";
const EXPORT_PATH_KEY = "mapsExtractorExcelPath";
const EXPORT_COLUMNS = [
  { key: "businessName", label: "Business Name" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "lat", label: "Latitude" },
  { key: "long", label: "Longitude" },
  { key: "phoneNumber", label: "Phone Number" },
  { key: "website", label: "Website" }
];

function setStatus(text, type = "info") {
  statusEl.textContent = text;
  statusEl.className = "status";
  if (type === "success") statusEl.classList.add("success");
  if (type === "error") statusEl.classList.add("error");
  if (type === "loading") statusEl.classList.add("loading");
}

function setCount(count) {
  countEl.textContent = `Saved records: ${count}`;
}

function setBusy(isBusy) {
  scrapeBtn.disabled = isBusy;
  exportBtn.disabled = isBusy;
  exportExcelBtn.disabled = isBusy;
  maxCountInput.disabled = isBusy;
  excelPathInput.disabled = isBusy;
}

async function readRows() {
  try {
    const res = await chrome.storage.local.get([STORAGE_KEY]);
    return Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
  } catch (_e) {
    return [];
  }
}

async function loadExportPath() {
  try {
    const res = await chrome.storage.local.get([EXPORT_PATH_KEY]);
    const path = typeof res[EXPORT_PATH_KEY] === "string" ? res[EXPORT_PATH_KEY] : "";
    excelPathInput.value = path;
  } catch (_e) {
    excelPathInput.value = "";
  }
}

async function saveExportPath(path) {
  await chrome.storage.local.set({ [EXPORT_PATH_KEY]: path });
}

function normalizeRelativePath(input) {
  const raw = String(input || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!raw) {
    return "";
  }

  const parts = raw
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[<>:"|?*\u0000-\u001F]/g, "_"));

  return parts.join("/");
}

function buildExcelFilename(now) {
  const rawInput = String(excelPathInput.value || "").trim();
  const folderHint = /[\\/]$/.test(rawInput);
  const customPath = normalizeRelativePath(rawInput);
  const defaultName = `google-maps-export-${now}.xls`;

  if (!customPath) {
    return defaultName;
  }

  if (folderHint) {
    return `${customPath}/${defaultName}`;
  }

  if (/\.xls$/i.test(customPath)) {
    return customPath;
  }

  if (/\.xlsx$/i.test(customPath)) {
    return customPath.replace(/\.xlsx$/i, ".xls");
  }

  if (customPath.includes("/")) {
    return `${customPath}.xls`;
  }

  return `${customPath}.xls`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildExcelHtml(rows) {
  const headerRow = EXPORT_COLUMNS.map(
    (column) => `<th>${escapeXml(column.label)}</th>`
  ).join("");

  const dataRows = rows
    .map((row) => {
      const cells = EXPORT_COLUMNS.map((column) => {
        const value = row?.[column.key] ?? "";
        return `<td>${escapeXml(value)}</td>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
      th, td { border: 1px solid #b8c2cc; padding: 6px; text-align: left; vertical-align: top; }
      th { background: #eaf2ff; font-weight: 700; }
    </style>
  </head>
  <body>
    <table>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${dataRows}</tbody>
    </table>
  </body>
</html>`;
}

async function downloadFile({ content, contentType, filename }) {
  const blob = new Blob([content], { type: contentType });
  const blobUrl = URL.createObjectURL(blob);

  try {
    await chrome.downloads.download({
      url: blobUrl,
      filename,
      saveAs: true
    });
    return true;
  } catch (_e) {
    const dataUrl = `data:${contentType},${encodeURIComponent(content)}`;
    await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: true
    });
    return true;
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function sendToContent(payload) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  return chrome.tabs.sendMessage(tab.id, payload);
}

async function refreshCount() {
  try {
    const rows = await readRows();
    setCount(rows.length);
  } catch (_e) {
    setCount(0);
  }
}

scrapeBtn.addEventListener("click", async () => {
  const maxCount = Number(maxCountInput.value || 50);
  setBusy(true);
  setStatus("Scraping in progress. Keep Google Maps tab open...", "loading");

  try {
    const res = await sendToContent({ type: "SCRAPE", maxCount });
    if (!res?.ok) {
      setStatus(res?.message || "Failed to scrape.", "error");
      return;
    }

    setStatus(res.message || "Scrape complete.", "success");
    setCount(res.count || 0);
  } catch (_e) {
    setStatus("Failed to connect. Open a Google Maps results page and retry.", "error");
  } finally {
    setBusy(false);
  }
});

exportBtn.addEventListener("click", async () => {
  setBusy(true);
  setStatus("Preparing JSON export...", "loading");

  try {
    const rows = await readRows();

    if (rows.length === 0) {
      setStatus("No data available. Scrape first.", "error");
      return;
    }

    const now = new Date().toISOString().replace(/[:.]/g, "-");
    await downloadFile({
      content: JSON.stringify(rows, null, 2),
      contentType: "application/json;charset=utf-8",
      filename: `google-maps-export-${now}.json`
    });

    setStatus(`Exported ${rows.length} rows to JSON.`, "success");
    setCount(rows.length);
  } catch (_e) {
    setStatus("Export failed.", "error");
  } finally {
    setBusy(false);
  }
});

exportExcelBtn.addEventListener("click", async () => {
  setBusy(true);
  setStatus("Preparing Excel export...", "loading");

  try {
    const rows = await readRows();

    if (rows.length === 0) {
      setStatus("No data available. Scrape first.", "error");
      return;
    }

    const excelHtml = buildExcelHtml(rows);
    const now = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = buildExcelFilename(now);
    await saveExportPath(excelPathInput.value.trim());
    await downloadFile({
      content: excelHtml,
      contentType: "application/vnd.ms-excel;charset=utf-8",
      filename
    });

    setStatus(`Exported ${rows.length} rows to Excel (${filename}).`, "success");
    setCount(rows.length);
  } catch (e) {
    setStatus(`Excel export failed: ${e?.message || "Unknown error."}`, "error");
  } finally {
    setBusy(false);
  }
});

clearBtn.addEventListener("click", async () => {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    setStatus("Saved data cleared.", "success");
    setCount(0);
  } catch (_e) {
    setStatus("Failed to clear data.", "error");
  }
});

excelPathInput.addEventListener("blur", async () => {
  await saveExportPath(excelPathInput.value.trim());
});

loadExportPath();
refreshCount();
