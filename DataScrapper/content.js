const STORAGE_KEY = "mapsExtractorData";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function extractLatLongFromUrl(url) {
  if (!url) {
    return { lat: null, long: null };
  }

  const bangMatch = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangMatch) {
    return { lat: Number(bangMatch[1]), long: Number(bangMatch[2]) };
  }

  const atMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/);
  if (atMatch) {
    return { lat: Number(atMatch[1]), long: Number(atMatch[2]) };
  }

  return { lat: null, long: null };
}

function parseCityState(address) {
  if (!address) {
    return { city: "", state: "" };
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const usStates = new Set([
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
  ]);

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const piece = parts[i];
    const m = piece.match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?$/);
    if (m && usStates.has(m[1])) {
      return {
        city: i > 0 ? parts[i - 1] : "",
        state: m[1]
      };
    }
  }

  const tailMatch = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  if (tailMatch && usStates.has(tailMatch[2])) {
    return { city: cleanText(tailMatch[1]), state: tailMatch[2] };
  }

  // Generic fallback for non-US addresses:
  // "Street/Area, City, State 530017" => city=City, state=State
  if (parts.length >= 2) {
    const statePart = parts[parts.length - 1].replace(/\b\d{4,6}(?:-\d{4})?\b/g, "").trim();
    const cityPart = parts[parts.length - 2].trim();
    return {
      city: cleanText(cityPart),
      state: cleanText(statePart)
    };
  }

  return { city: "", state: "" };
}

function pickFirstText(selectors) {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node) {
      const text = cleanText(node.innerText || node.textContent || "");
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function pickPhone() {
  const phoneBtn = document.querySelector('button[data-item-id^="phone:"], button[data-tooltip="Copy phone number"]');
  if (!phoneBtn) {
    return "";
  }

  const aria = cleanText(phoneBtn.getAttribute("aria-label") || "");
  const txt = cleanText(phoneBtn.innerText || phoneBtn.textContent || "");
  const merged = `${aria} ${txt}`.trim();
  const m = merged.match(/\+?\d[\d\s().-]{6,}\d/);
  return m ? cleanText(m[0]) : cleanText(txt);
}

function pickWebsite() {
  const websiteNode = document.querySelector(
    'a[data-item-id="authority"], a[data-item-id^="authority:"], button[data-item-id="authority"], button[data-tooltip="Open website"]'
  );
  if (!websiteNode) {
    return "";
  }

  if (websiteNode.tagName.toLowerCase() === "a") {
    const href = cleanText(websiteNode.getAttribute("href") || "");
    if (href) {
      return href;
    }
  }

  const aria = cleanText(websiteNode.getAttribute("aria-label") || "");
  const txt = cleanText(websiteNode.innerText || websiteNode.textContent || "");
  const merged = `${aria} ${txt}`.trim();
  const urlMatch = merged.match(/https?:\/\/[^\s)]+/i);
  if (urlMatch) {
    return cleanText(urlMatch[0]);
  }

  return txt;
}

function pickAddress() {
  const selectors = [
    'button[data-item-id="address"]',
    'button[data-tooltip="Copy address"]',
    'div[aria-label^="Address:"]'
  ];

  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (!node) {
      continue;
    }

    const rawText = cleanText(node.innerText || node.textContent || "");
    if (rawText) {
      return rawText.replace(/^Address:\s*/i, "");
    }

    const aria = cleanText(node.getAttribute("aria-label") || "");
    if (aria) {
      return aria.replace(/^Address:\s*/i, "");
    }
  }

  return "";
}

function extractCurrentBusiness() {
  const name = pickFirstText([
    "h1.DUwDvf",
    "h1.fontHeadlineLarge",
    "h1[class*='fontHeadlineLarge']"
  ]);

  const address = pickAddress();

  const phone = pickPhone();
  const website = pickWebsite();
  const { city, state } = parseCityState(address);
  const { lat, long } = extractLatLongFromUrl(window.location.href);

  if (!name) {
    return null;
  }

  return {
    businessName: name,
    address: address || "",
    city: city || "",
    state: state || "",
    lat,
    long,
    phoneNumber: phone,
    website: website || ""
  };
}

function mergeRows(existing, incoming) {
  return {
    businessName: incoming.businessName || existing.businessName || "",
    address: incoming.address || existing.address || "",
    city: incoming.city || existing.city || "",
    state: incoming.state || existing.state || "",
    lat: incoming.lat ?? existing.lat ?? null,
    long: incoming.long ?? existing.long ?? null,
    phoneNumber: incoming.phoneNumber || existing.phoneNumber || "",
    website: incoming.website || existing.website || ""
  };
}

function getFeedResults() {
  const feed = document.querySelector('div[role="feed"]');
  if (!feed) {
    return { feed: null, cards: [] };
  }

  const cards = Array.from(feed.querySelectorAll('div[role="article"]'));
  return { feed, cards };
}

function getCardKey(card) {
  const link = card.querySelector('a[href*="/maps/place"], a.hfpxzc');
  if (!link) {
    return cleanText(card.innerText).slice(0, 80);
  }

  const href = link.href || "";
  const placeIdMatch = href.match(/!1s([^!]+)!/);
  if (placeIdMatch) {
    return placeIdMatch[1];
  }

  return href;
}

async function clickCard(card) {
  const clickable = card.querySelector('a[href*="/maps/place"], a.hfpxzc') || card;
  clickable.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await sleep(1600);
}

async function readStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      resolve(Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : []);
    });
  });
}

async function writeStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
  });
}

async function scrapeMaps(maxCount) {
  const { feed } = getFeedResults();
  if (!feed) {
    return {
      ok: false,
      message: "No results feed found. Open a Google Maps search results page first."
    };
  }

  const existing = await readStorage();
  const byKey = new Map();

  for (const row of existing) {
    const normalized = {
      businessName: row.businessName || "",
      address: row.address || "",
      city: row.city || "",
      state: row.state || "",
      lat: row.lat ?? null,
      long: row.long ?? null,
      phoneNumber: row.phoneNumber || "",
      website: row.website || ""
    };
    const key = `${row.businessName || ""}|${row.phoneNumber || ""}|${row.lat || ""}|${row.long || ""}`;
    byKey.set(key, normalized);
  }

  const processedCards = new Set();
  let idleRounds = 0;

  while (byKey.size < maxCount && idleRounds < 6) {
    const { cards } = getFeedResults();
    let processedThisRound = 0;

    for (const card of cards) {
      if (byKey.size >= maxCount) {
        break;
      }

      const key = getCardKey(card);
      if (processedCards.has(key)) {
        continue;
      }

      processedCards.add(key);
      processedThisRound += 1;

      card.scrollIntoView({ behavior: "instant", block: "center" });
      await sleep(220);
      await clickCard(card);

      const row = extractCurrentBusiness();
      if (row) {
        const rowKey = `${row.businessName || ""}|${row.phoneNumber || ""}|${row.lat || ""}|${row.long || ""}`;
        const prev = byKey.get(rowKey);
        byKey.set(rowKey, prev ? mergeRows(prev, row) : row);
      }
    }

    const beforeScrollCount = getFeedResults().cards.length;
    feed.scrollBy(0, Math.max(feed.clientHeight, 800));
    await sleep(1400);
    const afterScrollCount = getFeedResults().cards.length;

    if (processedThisRound === 0 && afterScrollCount <= beforeScrollCount) {
      idleRounds += 1;
    } else {
      idleRounds = 0;
    }
  }

  const result = Array.from(byKey.values());
  await writeStorage(result);

  return {
    ok: true,
    count: result.length,
    message: `Saved ${result.length} business records.`
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "SCRAPE") {
      const maxCount = Number(message.maxCount) > 0 ? Number(message.maxCount) : 50;
      const res = await scrapeMaps(maxCount);
      sendResponse(res);
      return;
    }

    if (message?.type === "GET_DATA") {
      const data = await readStorage();
      sendResponse({ ok: true, data, count: data.length });
      return;
    }

    if (message?.type === "CLEAR_DATA") {
      await writeStorage([]);
      sendResponse({ ok: true, count: 0, message: "Data cleared." });
      return;
    }

    sendResponse({ ok: false, message: "Unknown action." });
  })();

  return true;
});
