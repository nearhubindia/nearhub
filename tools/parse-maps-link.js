#!/usr/bin/env node
// Lightweight parser/test harness copied from app logic to expand and parse Google Maps links.
// Usage: node tools/parse-maps-link.js "https://maps.app.goo.gl/.."

const fetch = global.fetch || require('node-fetch');

function isValidCoordinates(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function buildCoordinates(latRaw, lonRaw) {
  const parsedLatitude = Number.parseFloat(latRaw);
  const parsedLongitude = Number.parseFloat(lonRaw);
  if (!isValidCoordinates(parsedLatitude, parsedLongitude)) return null;
  return { latitude: parsedLatitude, longitude: parsedLongitude };
}

function extractPlusCodeCandidate(value) {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/([23456789CFGHJMPQRVWX0]{2,8}\+[23456789CFGHJMPQRVWX0]{2,})/);
  return match?.[1] ?? null;
}

function isShortPlusCode(code) {
  const separatorIndex = code.indexOf('+');
  return separatorIndex > 0 && separatorIndex < 8;
}

function decodeFullPlusCode(code) {
  try {
    const normalized = code.trim().toUpperCase();
    if (!/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,}$/.test(normalized)) return null;
    const alphabet = '23456789CFGHJMPQRVWX';
    const pairResolutions = [20,1,0.05,0.0025,0.000125];
    const gridRows = 5; const gridColumns = 4; const gridSize = 0.000125;
    const codeWithoutSeparator = normalized.replace('+','');
    const pairCodeLength = Math.min(codeWithoutSeparator.length, 10);
    if (pairCodeLength < 2 || pairCodeLength % 2 !== 0) return null;
    let decodedLatitude = -90; let decodedLongitude = -180;
    for (let i=0;i<pairCodeLength;i+=2){
      const latitudeDigit = alphabet.indexOf(codeWithoutSeparator[i] ?? '');
      const longitudeDigit = alphabet.indexOf(codeWithoutSeparator[i+1] ?? '');
      if (latitudeDigit < 0 || longitudeDigit < 0) return null;
      const resolution = pairResolutions[i/2] ?? pairResolutions[pairResolutions.length-1];
      decodedLatitude += latitudeDigit * resolution;
      decodedLongitude += longitudeDigit * resolution;
    }
    let latitudePlaceValue = pairCodeLength < 10 ? (pairResolutions[pairCodeLength/2 -1] ?? 20) : gridSize;
    let longitudePlaceValue = latitudePlaceValue;
    for (let i=pairCodeLength;i<codeWithoutSeparator.length;i+=1){
      const digit = alphabet.indexOf(codeWithoutSeparator[i] ?? '');
      if (digit < 0) return null;
      const row = Math.floor(digit / gridColumns);
      const column = digit % gridColumns;
      latitudePlaceValue /= gridRows; longitudePlaceValue /= gridColumns;
      decodedLatitude += row * latitudePlaceValue;
      decodedLongitude += column * longitudePlaceValue;
    }
    const centerLatitude = decodedLatitude + latitudePlaceValue/2;
    const centerLongitude = decodedLongitude + longitudePlaceValue/2;
    if (!isValidCoordinates(centerLatitude, centerLongitude)) return null;
    return { latitude: centerLatitude, longitude: centerLongitude };
  } catch(e) { return null; }
}

function parseCoordinatesFromMapsLink(input) {
  const raw = input.trim();
  if (!raw) return null;
  const standaloneCoordinateMatch = raw.match(/^\s*[\[(]?\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*[\])]?\s*$/);
  if (standaloneCoordinateMatch) {
    const built = buildCoordinates(standaloneCoordinateMatch[1] ?? '', standaloneCoordinateMatch[2] ?? '');
    if (built) return built;
  }
  const queue = [raw]; const visited = new Set();
  while (queue.length>0) {
    const candidateRaw = queue.shift(); if (!candidateRaw) continue;
    const candidate = candidateRaw.trim(); if (!candidate || visited.has(candidate)) continue;
    visited.add(candidate);
    const variants = [candidate]; let decodeAttempt = candidate;
    for (let i=0;i<3;i++){
      try{ const next = decodeURIComponent(decodeAttempt); if (!next || next===decodeAttempt) break; variants.push(next); decodeAttempt = next; }catch(e){break}
    }
    for (const variant of variants){
      const encodedReverseDataMatch = variant.match(/%212d(-?\d+(?:\.\d+)?)%213d(-?\d+(?:\.\d+)?)/i);
      if (encodedReverseDataMatch){ const built = buildCoordinates(encodedReverseDataMatch[2] ?? '', encodedReverseDataMatch[1] ?? ''); if (built) return built; }
      const reverseDataMatch = variant.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/i);
      if (reverseDataMatch){ const built = buildCoordinates(reverseDataMatch[2] ?? '', reverseDataMatch[1] ?? ''); if (built) return built; }
      const simplePatterns = [ /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i, /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i, /[?&](?:q|query|ll|sll|daddr|destination|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i, /\/search\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i, /geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i ];
      for (const pattern of simplePatterns){
        const match = variant.match(pattern);
        if (!match) continue;
        const built = buildCoordinates(match[1] ?? '', match[2] ?? ''); if (built) return built;
      }
      const dmsMatch = variant.match(/(\d{1,2})°\s*(\d{1,2})[’'′]\s*(\d{1,2}(?:\.\d+)?)[”"″]?\s*([NS]).*?(\d{1,3})°\s*(\d{1,2})[’'′]\s*(\d{1,2}(?:\.\d+)?)[”"″]?\s*([EW])/i);
      if (dmsMatch){ const latitudeFromDms = (n=>{const [d,m,s,dir]=n;return (Number(d)+Number(m)/60+Number(s)/3600)*(/[SW]/i.test(dir)?-1:1)})([dmsMatch[1],dmsMatch[2],dmsMatch[3],dmsMatch[4]]); const longitudeFromDms = (n=>{const [d,m,s,dir]=n;return (Number(d)+Number(m)/60+Number(s)/3600)*(/[SW]/i.test(dir)?-1:1)})([dmsMatch[5],dmsMatch[6],dmsMatch[7],dmsMatch[8]]); if (isValidCoordinates(latitudeFromDms, longitudeFromDms)) return {latitude:latitudeFromDms, longitude: longitudeFromDms}; }
      const plusCodeCandidate = extractPlusCodeCandidate(variant);
      if (plusCodeCandidate && !isShortPlusCode(plusCodeCandidate)){
        const decodedPlusCode = decodeFullPlusCode(plusCodeCandidate); if (decodedPlusCode) return decodedPlusCode;
      }
      try{
        const normalized = /^https?:\/\//i.test(variant) ? variant : `https://${variant}`;
        const parsedUrl = new URL(normalized);
        const queryCoordinateKeys = ['q','query','ll','sll','daddr','destination','center'];
        for (const key of queryCoordinateKeys){ const value = parsedUrl.searchParams.get(key); if (!value) continue; const parts = value.split(',').map(p=>p.trim()); if (parts.length<2) continue; const built = buildCoordinates(parts[0]??'', parts[1]??''); if (built) return built; }
        const nestedLink = parsedUrl.searchParams.get('link'); if (nestedLink && !visited.has(nestedLink)) queue.push(nestedLink);
      }catch(e){}
    }
  }
  return null;
}

async function expandGoogleMapsShortLink(input){
  const raw = input.trim(); if (!raw) return raw; const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  if (!/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(normalized)) return normalized;
  let timeoutId = null;
  try{
    const controller = new AbortController(); timeoutId = setTimeout(()=>controller.abort(),7000);
    const response = await fetch(normalized, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'NearHub/1.0 (+maps-link-parser)'}});
    const redirected = response.url || normalized;
    if (redirected && redirected !== normalized){ const redirectedCoordinates = parseCoordinatesFromMapsLink(redirected); if (redirectedCoordinates) return redirected; }
    const html = await response.text();
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const canonicalUrl = canonicalMatch?.[1]?.trim(); if (canonicalUrl){ const canonicalCoordinates = parseCoordinatesFromMapsLink(canonicalUrl); if (canonicalCoordinates) return canonicalUrl; }
    if (canonicalUrl) return canonicalUrl;
    if (redirected && redirected !== normalized) return redirected;
    return normalized;
  }catch(e){return normalized;}finally{ if (timeoutId) clearTimeout(timeoutId);} }

(async ()=>{
  const input = process.argv[2];
  if (!input){ console.error('Provide a maps link'); process.exit(2); }
  console.log('Input:', input);
  const candidates = [input];
  for (const c of candidates){
    console.log('\n--- Trying candidate ---\n', c);
    let parsed = parseCoordinatesFromMapsLink(c);
    console.log('Local parse result:', parsed);
    if (!parsed){
      const expanded = await expandGoogleMapsShortLink(c);
      console.log('Expanded URL:', expanded);
      parsed = parseCoordinatesFromMapsLink(expanded);
      console.log('Parsed after expand:', parsed);
    }
    if (parsed){ console.log('SUCCESS coordinates:', parsed); process.exit(0); }
  }
  console.error('No coordinates parsed'); process.exit(1);
})();
