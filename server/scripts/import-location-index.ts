#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { sql } from 'drizzle-orm';
import '../data/env';
import { db } from '../data/db';
import { locationIndex } from '../features/admin/models/admin-settings';

interface GeometryPolygon {
  type?: string;
  coordinates?: number[][][];
}

interface GeoJsonFeature {
  properties?: {
    Pincode?: string;
    Office_Name?: string;
    Division?: string;
    Region?: string;
    Circle?: string;
  };
  geometry?: GeometryPolygon;
}

interface GeoJsonFeatureCollection {
  features?: GeoJsonFeature[];
}

interface LocationSeedRecord {
  pincode: string;
  locationName: string;
  city: string;
  state: string;
  district: string;
  latitude: string;
  longitude: string;
  region: string;
  searchText: string;
  score: number;
}

function normalizeLocationName(rawOfficeName: string): string {
  return rawOfficeName
    .replace(/\s+(S\.O|B\.O|H\.O|SO|BO|HO)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function deriveCityName(officeName: string, district: string): string {
  const inParens = officeName.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (inParens) {
    return inParens;
  }

  const normalized = normalizeLocationName(officeName);
  return normalized || district;
}

function scoreLocationCandidate(officeName: string, locationName: string, city: string): number {
  const hasParenCity = /\(([^)]+)\)/.test(officeName);
  let score = hasParenCity ? 100 : 10;

  if (locationName && city && locationName.toLowerCase() !== city.toLowerCase()) {
    score += 20;
  }

  if (/^[a-zA-Z\s]+$/.test(locationName)) {
    score += 5;
  }

  return score;
}

function computeCenter(ring: number[][]): { latitude: number; longitude: number } | null {
  if (!ring.length) {
    return null;
  }

  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const pair of ring) {
    const lon = pair[0];
    const lat = pair[1];

    if (typeof lon !== 'number' || typeof lat !== 'number') {
      continue;
    }

    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) {
    return null;
  }

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
  };
}

function getGeoJsonPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data/pincode_geo.geojson'),
    path.join(process.cwd(), 'server/data/pincode_geo.geojson'),
  ];

  const geoJsonPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!geoJsonPath) {
    throw new Error(`[Location Import] GeoJSON file not found. Checked: ${candidates.join(', ')}`);
  }

  return geoJsonPath;
}

function toSearchText(record: Omit<LocationSeedRecord, 'searchText' | 'score'>): string {
  return [
    record.pincode,
    record.locationName,
    record.city,
    record.state,
    record.district,
    record.region,
  ]
    .join(' ')
    .toLowerCase()
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function importLocationIndex() {
  console.log('[Location Import] Starting scrub + DB import...');
  const startTime = Date.now();

  const geoJsonPath = getGeoJsonPath();
  console.log(`[Location Import] Reading GeoJSON: ${geoJsonPath}`);

  const raw = fs.readFileSync(geoJsonPath, 'utf8');
  const source = JSON.parse(raw) as GeoJsonFeatureCollection;
  const features = Array.isArray(source.features) ? source.features : [];

  const bestByPincode = new Map<string, LocationSeedRecord>();

  for (const feature of features) {
    const pincode = feature.properties?.Pincode?.trim();
    const officeName = feature.properties?.Office_Name?.trim() || '';
    const district = (feature.properties?.Division || '').trim();
    const state = (feature.properties?.Circle || '').trim();
    const region = (feature.properties?.Region || '').trim();
    const ring = feature.geometry?.coordinates?.[0] || [];

    if (!pincode || !/^\d{6}$/.test(pincode) || !officeName || ring.length === 0) {
      continue;
    }

    const center = computeCenter(ring);
    if (!center) {
      continue;
    }

    const locationName = normalizeLocationName(officeName);
    const city = deriveCityName(officeName, district);
    if (!city) {
      continue;
    }

    const score = scoreLocationCandidate(officeName, locationName, city);
    const nextRecord: Omit<LocationSeedRecord, 'searchText' | 'score'> = {
      pincode,
      locationName: locationName || city,
      city,
      state,
      district,
      latitude: center.latitude.toFixed(7),
      longitude: center.longitude.toFixed(7),
      region,
    };

    const record: LocationSeedRecord = {
      ...nextRecord,
      searchText: toSearchText(nextRecord),
      score,
    };

    const existing = bestByPincode.get(pincode);
    if (!existing || score > existing.score) {
      bestByPincode.set(pincode, record);
    }
  }

  const rows = Array.from(bestByPincode.values()).map(({ score: _score, ...row }) => row);
  console.log(`[Location Import] Scrubbed rows: ${rows.length}`);

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await db
      .insert(locationIndex)
      .values(chunk)
      .onConflictDoUpdate({
        target: locationIndex.pincode,
        set: {
          locationName: sql`excluded.location_name`,
          city: sql`excluded.city`,
          state: sql`excluded.state`,
          district: sql`excluded.district`,
          latitude: sql`excluded.latitude`,
          longitude: sql`excluded.longitude`,
          region: sql`excluded.region`,
          searchText: sql`excluded.search_text`,
          updatedAt: new Date(),
        },
      });

    console.log(
      `[Location Import] Upserted ${Math.min(i + chunk.length, rows.length)}/${rows.length}`
    );
  }

  console.log(`[Location Import] ✅ Completed in ${Date.now() - startTime}ms`);
}

importLocationIndex()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Location Import] Failed:', error);
    process.exit(1);
  });
