import type { Express, Request, Response } from 'express';
import { and, desc, eq, ilike, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { listings, locationIndex } from '../../admin/models/admin-settings';
import { geolocationService } from '../services/geolocation';
import {
  type LocationRecord,
  type LocationMetrics,
  calculateDistance,
  computeDemandScore,
  ensureLocationIndexAvailable,
  getLocationByPincode,
  getMetricsForPincode,
  searchLocationRecords,
  toLocationRecord,
  toNumber,
} from '../services/location';

type ParsedCoordinates = {
  latitude: number;
  longitude: number;
};

function isValidCoordinates(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function buildCoordinates(latRaw: string, lonRaw: string): ParsedCoordinates | null {
  const parsedLatitude = Number.parseFloat(latRaw);
  const parsedLongitude = Number.parseFloat(lonRaw);
  if (!isValidCoordinates(parsedLatitude, parsedLongitude)) {
    return null;
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
}

function toDecimal(degrees: string, minutes: string, seconds: string, direction: string): number {
  const absolute =
    Number.parseFloat(degrees) +
    Number.parseFloat(minutes) / 60 +
    Number.parseFloat(seconds) / 3600;
  return /[SW]/i.test(direction) ? -absolute : absolute;
}

function extractPlusCodeCandidate(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/([23456789CFGHJMPQRVWX0]{2,8}\+[23456789CFGHJMPQRVWX0]{2,})/);
  return match?.[1] ?? null;
}

function isShortPlusCode(code: string): boolean {
  const separatorIndex = code.indexOf('+');
  return separatorIndex > 0 && separatorIndex < 8;
}

function decodeFullPlusCode(code: string): ParsedCoordinates | null {
  const normalized = code.trim().toUpperCase();
  if (!/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,}$/.test(normalized)) {
    return null;
  }

  const alphabet = '23456789CFGHJMPQRVWX';
  const pairResolutions = [20, 1, 0.05, 0.0025, 0.000125];
  const gridRows = 5;
  const gridColumns = 4;
  const gridSize = 0.000125;
  const codeWithoutSeparator = normalized.replace('+', '');
  const pairCodeLength = Math.min(codeWithoutSeparator.length, 10);

  if (pairCodeLength < 2 || pairCodeLength % 2 !== 0) {
    return null;
  }

  let decodedLatitude = -90;
  let decodedLongitude = -180;

  for (let i = 0; i < pairCodeLength; i += 2) {
    const latitudeDigit = alphabet.indexOf(codeWithoutSeparator[i] ?? '');
    const longitudeDigit = alphabet.indexOf(codeWithoutSeparator[i + 1] ?? '');
    if (latitudeDigit < 0 || longitudeDigit < 0) {
      return null;
    }

    const resolution = pairResolutions[i / 2] ?? pairResolutions[pairResolutions.length - 1];
    decodedLatitude += latitudeDigit * resolution;
    decodedLongitude += longitudeDigit * resolution;
  }

  let latitudePlaceValue =
    pairCodeLength < 10 ? (pairResolutions[pairCodeLength / 2 - 1] ?? 20) : gridSize;
  let longitudePlaceValue = latitudePlaceValue;

  for (let i = pairCodeLength; i < codeWithoutSeparator.length; i += 1) {
    const digit = alphabet.indexOf(codeWithoutSeparator[i] ?? '');
    if (digit < 0) {
      return null;
    }

    const row = Math.floor(digit / gridColumns);
    const column = digit % gridColumns;
    latitudePlaceValue /= gridRows;
    longitudePlaceValue /= gridColumns;
    decodedLatitude += row * latitudePlaceValue;
    decodedLongitude += column * longitudePlaceValue;
  }

  const centerLatitude = decodedLatitude + latitudePlaceValue / 2;
  const centerLongitude = decodedLongitude + longitudePlaceValue / 2;
  if (!isValidCoordinates(centerLatitude, centerLongitude)) {
    return null;
  }

  return {
    latitude: centerLatitude,
    longitude: centerLongitude,
  };
}

function parseCoordinatesFromMapsInput(input: string): ParsedCoordinates | null {
  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const standaloneCoordinateMatch = raw.match(
    /^\s*(?:\(|\[)?\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*(?:\)|\])?\s*$/
  );
  if (standaloneCoordinateMatch) {
    const built = buildCoordinates(
      standaloneCoordinateMatch[1] ?? '',
      standaloneCoordinateMatch[2] ?? ''
    );
    if (built) {
      return built;
    }
  }

  const queue: string[] = [raw];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const candidateRaw = queue.shift();
    if (!candidateRaw) continue;
    const candidate = candidateRaw.trim();
    if (!candidate || visited.has(candidate)) continue;
    visited.add(candidate);

    const variants = [candidate];
    let decodeAttempt = candidate;
    for (let i = 0; i < 3; i += 1) {
      try {
        const next = decodeURIComponent(decodeAttempt);
        if (!next || next === decodeAttempt) break;
        variants.push(next);
        decodeAttempt = next;
      } catch {
        break;
      }
    }

    for (const variant of variants) {
      const encodedReverseDataMatch = variant.match(
        /%212d(-?\d+(?:\.\d+)?)%213d(-?\d+(?:\.\d+)?)/i
      );
      if (encodedReverseDataMatch) {
        const built = buildCoordinates(
          encodedReverseDataMatch[2] ?? '',
          encodedReverseDataMatch[1] ?? ''
        );
        if (built) {
          return built;
        }
      }

      const reverseDataMatch = variant.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/i);
      if (reverseDataMatch) {
        const built = buildCoordinates(reverseDataMatch[2] ?? '', reverseDataMatch[1] ?? '');
        if (built) {
          return built;
        }
      }

      const simplePatterns = [
        /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
        /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
        /[?&](?:q|query|ll|sll|daddr|destination|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i,
        /\/search\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
        /geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
      ];

      for (const pattern of simplePatterns) {
        const match = variant.match(pattern);
        if (!match) continue;
        const built = buildCoordinates(match[1] ?? '', match[2] ?? '');
        if (built) {
          return built;
        }
      }

      const dmsMatch = variant.match(
        /(\d{1,2})°\s*(\d{1,2})[’'′]\s*(\d{1,2}(?:\.\d+)?)[”"″]?\s*([NS]).*?(\d{1,3})°\s*(\d{1,2})[’'′]\s*(\d{1,2}(?:\.\d+)?)[”"″]?\s*([EW])/i
      );
      if (dmsMatch) {
        const latitudeFromDms = toDecimal(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4]);
        const longitudeFromDms = toDecimal(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8]);
        if (isValidCoordinates(latitudeFromDms, longitudeFromDms)) {
          return {
            latitude: latitudeFromDms,
            longitude: longitudeFromDms,
          };
        }
      }

      const plusCodeCandidate = extractPlusCodeCandidate(variant);
      if (plusCodeCandidate && !isShortPlusCode(plusCodeCandidate)) {
        const decodedPlusCode = decodeFullPlusCode(plusCodeCandidate);
        if (decodedPlusCode) {
          return decodedPlusCode;
        }
      }

      try {
        const normalized = /^https?:\/\//i.test(variant) ? variant : `https://${variant}`;
        const parsedUrl = new URL(normalized);
        const queryCoordinateKeys = ['q', 'query', 'll', 'sll', 'daddr', 'destination', 'center'];
        for (const key of queryCoordinateKeys) {
          const value = parsedUrl.searchParams.get(key);
          if (!value) continue;
          const parts = value.split(',').map((part) => part.trim());
          if (parts.length < 2) continue;
          const built = buildCoordinates(parts[0] ?? '', parts[1] ?? '');
          if (built) {
            return built;
          }
        }

        const nestedLink = parsedUrl.searchParams.get('link');
        if (nestedLink && !visited.has(nestedLink)) {
          queue.push(nestedLink);
        }
      } catch {
        // Ignore invalid URL parsing and continue
      }
    }
  }

  return null;
}

function parseCoordinatesFromGoogleMapsHtml(html: string): ParsedCoordinates | null {
  const trimmed = html.trim();
  if (!trimmed) {
    return null;
  }

  const encodedReverseDataMatch = trimmed.match(/%212d(-?\d+(?:\.\d+)?)%213d(-?\d+(?:\.\d+)?)/i);
  if (encodedReverseDataMatch) {
    const built = buildCoordinates(
      encodedReverseDataMatch[2] ?? '',
      encodedReverseDataMatch[1] ?? ''
    );
    if (built) {
      return built;
    }
  }

  const reverseDataMatch = trimmed.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/i);
  if (reverseDataMatch) {
    const built = buildCoordinates(reverseDataMatch[2] ?? '', reverseDataMatch[1] ?? '');
    if (built) {
      return built;
    }
  }

  const dataMatch = trimmed.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (dataMatch) {
    const built = buildCoordinates(dataMatch[1] ?? '', dataMatch[2] ?? '');
    if (built) {
      return built;
    }
  }

  const centerMatch = trimmed.match(
    /(?:\?|&|&amp;)(?:q|query|ll|sll|daddr|destination|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i
  );
  if (centerMatch) {
    const built = buildCoordinates(centerMatch[1] ?? '', centerMatch[2] ?? '');
    if (built) {
      return built;
    }
  }

  return null;
}

function isStandaloneShortPlusCodeInput(value: string): boolean {
  try {
    const normalized = decodeURIComponent(value).toUpperCase();
    if (/^https?:\/\//i.test(normalized) || normalized.includes('/')) {
      return false;
    }

    const match = normalized
      .trim()
      .match(/([23456789CFGHJMPQRVWX0]{2,8}\+[23456789CFGHJMPQRVWX0]{2,})/);
    const code = match?.[1] ?? '';
    const separatorIndex = code.indexOf('+');
    return separatorIndex > 0 && separatorIndex < 8;
  } catch {
    return false;
  }
}

async function expandGoogleMapsShortLink(input: string): Promise<string> {
  const raw = input.trim();
  if (!raw) {
    return raw;
  }

  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  if (!/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(normalized)) {
    return normalized;
  }

  let timeoutId: NodeJS.Timeout | null = null;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(normalized, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'NearHub/1.0 (+maps-link-parser)',
      },
    });

    const redirected = response.url || normalized;
    if (redirected && redirected !== normalized) {
      const redirectedCoordinates = parseCoordinatesFromMapsInput(redirected);
      if (redirectedCoordinates) {
        return redirected;
      }
    }

    const html = await response.text();
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const canonicalUrl = canonicalMatch?.[1]?.trim();
    if (canonicalUrl) {
      const canonicalCoordinates = parseCoordinatesFromMapsInput(canonicalUrl);
      if (canonicalCoordinates) {
        return canonicalUrl;
      }
    }

    if (canonicalUrl) {
      return canonicalUrl;
    }

    if (redirected && redirected !== normalized) {
      return redirected;
    }

    return normalized;
  } catch {
    return normalized;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function normalizeMapsInputToken(value: string): string {
  return value
    .trim()
    .replace(/^[<([{'"`\s]+/, '')
    .replace(/[>\])}'"`,;!\s]+$/, '');
}

function extractPincodeHint(value: string): string | null {
  const match = value.match(/(?:^|\D)(\d{6})(?:\D|$)/);
  return match?.[1] ?? null;
}

function extractMapsInputCandidates(input: string): string[] {
  const candidates = new Set<string>();
  const addCandidate = (value: string) => {
    const normalized = normalizeMapsInputToken(value);
    if (normalized) {
      candidates.add(normalized);
    }
  };

  addCandidate(input);

  const lines = input
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    addCandidate(line);
  }

  const mapsLinkRegex =
    /(https?:\/\/[^\s<>"']+|(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/[^\s<>"']+)/gi;
  const matches = input.match(mapsLinkRegex) ?? [];
  for (const match of matches) {
    addCandidate(match);
  }

  return Array.from(candidates);
}

function extractPlaceNameFromMapsUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    
    // Check if this is a place URL: /maps/place/{place-name}
    const placeMatch = pathname.match(/\/maps\/place\/([^/]+)/i);
    if (placeMatch?.[1]) {
      // Decode URL-encoded place name
      let placeName = decodeURIComponent(placeMatch[1]);
      // Replace + with space and clean up
      placeName = placeName.replace(/\+/g, ' ').trim();
      
      // Extract location components from Google Places format
      // Pattern: "PlaceName, ...address..., City, State Pincode"
      // Try to extract pincode first (6-digit number at the end)
      const pincodeMatch = placeName.match(/(\d{6})/);
      const pincode = pincodeMatch?.[1];
      
      // Extract state and city (usually after comma and before pincode)
      const parts = placeName.split(',').map((p) => p.trim());
      
      // Look for city and state (usually the last meaningful parts before pincode)
      let searchQuery = '';
      if (pincode) {
        // If we have pincode, search for it as primary
        searchQuery = pincode;
      } else if (parts.length > 0) {
        // Otherwise search for the last meaningful part (usually city)
        const lastPart = parts[parts.length - 1] ?? '';
        // Filter out short parts and ones that look like addresses
        const meaningfulParts = parts.filter(
          (p) => p.length > 2 && !/^\d+/.test(p) && !/road|street|way|near/i.test(p)
        );
        if (meaningfulParts.length > 0) {
          // Combine last 1-2 meaningful parts for search
          searchQuery = meaningfulParts.slice(-2).join(', ');
        }
      }
      
      if (searchQuery.length > 0) {
        console.log(`[Location] Extracted search query from place name: "${searchQuery}"`);
        return searchQuery;
      }
    }
  } catch {
    // Ignore URL parsing errors
  }
  return null;
}

async function tryCoordinatesFromPlaceName(placeName: string): Promise<ParsedCoordinates | null> {
  try {
    if (!placeName || placeName.length < 2) {
      return null;
    }
    
    // Search for the place in the location index
    const records = await searchLocationRecords(placeName, 5);
    if (records && records.length > 0) {
      const bestRecord = records[0];
      if (
        bestRecord &&
        Number.isFinite(bestRecord.latitude) &&
        Number.isFinite(bestRecord.longitude)
      ) {
        return {
          latitude: bestRecord.latitude,
          longitude: bestRecord.longitude,
        };
      }
    }
  } catch (error) {
    console.warn('[Location] Error searching for place name:', placeName, error);
  }
  return null;
}

async function findNearestIndexedLocation(
  lat: number,
  lon: number,
  radiusKm = 0.25
): Promise<(LocationRecord & { distanceKm: number }) | null> {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));

  const candidates = await db
    .select()
    .from(locationIndex)
    .where(
      sql`cast(${locationIndex.latitude} as numeric) between ${lat - latDelta} and ${lat + latDelta}
        and cast(${locationIndex.longitude} as numeric) between ${lon - lonDelta} and ${lon + lonDelta}`
    )
    .limit(50);

  const nearest = candidates
    .map((row) => {
      const location = toLocationRecord(row);
      const distanceKm = calculateDistance(lat, lon, location.latitude, location.longitude);
      return { ...location, distanceKm };
    })
    .filter((row) => row.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  if (!nearest) {
    return null;
  }

  return {
    ...nearest,
    distanceKm: Number(nearest.distanceKm.toFixed(4)),
  };
}

/**
 * Register location-based routes with the Express app
 */
export async function registerLocationRoutes(app: Express) {
  console.log('[Location] Initializing location routes (DB-backed index)...');
  await ensureLocationIndexAvailable();

  console.log('[Location] Initializing geolocation service...');
  await geolocationService.initialize();
  if (geolocationService.isInitialized()) {
    console.log(
      `[Location] ✅ Geolocation ready with ${geolocationService.getPolygonCount()} pincode boundaries`
    );
  }

  app.post('/api/location/parse-maps-link', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { input?: unknown; url?: unknown };
      const rawInput = body.input ?? body.url;
      const input = typeof rawInput === 'string' ? rawInput.trim() : '';

      if (!input) {
        return res.status(400).json({
          success: false,
          error: 'input is required',
          code: 'INPUT_REQUIRED',
        });
      }

      if (input.length > 4096) {
        return res.status(400).json({
          success: false,
          error: 'input is too long',
          code: 'INPUT_TOO_LONG',
        });
      }

      const candidates = extractMapsInputCandidates(input);
      let parsed: ParsedCoordinates | null = null;
      let expanded = input;

      const isHintMismatch = async (
        source: string,
        coordinates: ParsedCoordinates
      ): Promise<boolean> => {
        const hintedPincode = extractPincodeHint(source);
        if (!hintedPincode) {
          return false;
        }

        const hintedLocation = await getLocationByPincode(hintedPincode);
        if (!hintedLocation) {
          return false;
        }

        const resolved = await geolocationService.getPincodeByCoordinates(
          coordinates.latitude,
          coordinates.longitude
        );
        if (!resolved?.pincode) {
          return false;
        }

        return resolved.pincode !== hintedPincode;
      };

      for (const candidate of candidates) {
        parsed = parseCoordinatesFromMapsInput(candidate);
        if (parsed) {
          const shouldReject = await isHintMismatch(`${input}\n${candidate}`, parsed);
          if (!shouldReject) {
            expanded = candidate;
            break;
          }
          parsed = null;
        }

        const expandedCandidate = await expandGoogleMapsShortLink(candidate);
        parsed = parseCoordinatesFromMapsInput(expandedCandidate);
        if (parsed) {
          const shouldReject = await isHintMismatch(
            `${input}\n${candidate}\n${expandedCandidate}`,
            parsed
          );
          if (!shouldReject) {
            expanded = expandedCandidate;
            break;
          }
          parsed = null;
        }

        // Fallback: Try to extract place name from Google Maps place URL and search for coordinates
        if (!parsed) {
          const placeName = extractPlaceNameFromMapsUrl(expandedCandidate);
          if (placeName) {
            console.log('[Location] Attempting place name search for:', placeName);
            parsed = await tryCoordinatesFromPlaceName(placeName);
            if (parsed) {
              console.log(
                '[Location] Found coordinates from place name search:',
                parsed.latitude,
                parsed.longitude
              );
              expanded = expandedCandidate;
              break;
            }
          }
        }
      }

      if (!parsed) {
        if (isStandaloneShortPlusCodeInput(input)) {
          return res.status(422).json({
            success: false,
            code: 'SHORT_PLUS_CODE_REQUIRES_CONTEXT',
            error:
              'Short Plus Code needs area context. Paste full Plus Code or lat,long like 17.3850,78.4867',
          });
        }

        return res.status(422).json({
          success: false,
          code: 'COORDINATES_NOT_FOUND',
          error:
            'Could not extract coordinates. Paste full Plus Code or pin coordinates like 17.3850,78.4867',
        });
      }

      return res.json({
        success: true,
        data: {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          expandedUrl: expanded !== input ? expanded : null,
        },
      });
    } catch (error) {
      console.error('[Location] Error parsing maps link:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to parse maps link',
        code: 'PARSE_FAILED',
      });
    }
  });

  app.get('/api/location/reverse-geocode', async (req: Request, res: Response) => {
    try {
      const { latitude, longitude } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'latitude and longitude are required',
        });
      }

      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid latitude or longitude. Must be numbers.',
        });
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          error: 'Latitude must be -90 to 90, longitude -180 to 180',
        });
      }

      const nearestIndexedLocation = await findNearestIndexedLocation(lat, lng);
      if (nearestIndexedLocation) {
        return res.json({
          success: true,
          data: {
            ...nearestIndexedLocation,
            matchType: 'nearest-index',
            originalCoordinates: {
              latitude: lat,
              longitude: lng,
            },
          },
        });
      }

      const pincodeResult = await geolocationService.getPincodeByCoordinates(lat, lng);
      if (!pincodeResult) {
        return res.status(404).json({
          success: false,
          error: 'No pincode found for these coordinates',
        });
      }

      const location = await getLocationByPincode(pincodeResult.pincode);
      if (!location) {
        return res.status(404).json({
          success: false,
          error: `Location data not found for pincode: ${pincodeResult.pincode}`,
        });
      }

      return res.json({
        success: true,
        data: {
          ...location,
          matchType: pincodeResult.accuracy,
          originalCoordinates: {
            latitude: lat,
            longitude: lng,
          },
        },
      });
    } catch (error) {
      console.error('[Location] Error reverse geocoding:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to reverse geocode coordinates',
      });
    }
  });

  app.get('/api/location/pincode/:pincode', async (req, res) => {
    try {
      const { pincode } = req.params;

      if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pincode. Please enter a valid 6-digit pincode.',
        });
      }

      const location = await getLocationByPincode(pincode);
      if (!location) {
        return res.status(404).json({
          success: false,
          error: 'Pincode not found in our database.',
        });
      }

      return res.json({
        success: true,
        data: location,
      });
    } catch (error) {
      console.error('[Location] Error looking up pincode:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to lookup pincode',
      });
    }
  });

  app.get('/api/location/cities/search', async (req: Request, res: Response) => {
    try {
      const rawQuery = (req.query.q as string | undefined)?.trim() ?? '';
      if (rawQuery.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Query must be at least 2 characters',
        });
      }

      const requestedLimit = Number.parseInt((req.query.limit as string) ?? '10', 10);
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(20, requestedLimit))
        : 10;

      const records = await searchLocationRecords(rawQuery, limit);

      return res.json({
        success: true,
        data: records,
      });
    } catch (error) {
      console.error('[Location] Error searching cities:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to search cities',
      });
    }
  });

  app.get('/api/location/city/:city', async (req, res) => {
    try {
      const { city } = req.params;
      const state = String(req.query.state || '').trim();

      if (!city) {
        return res.status(400).json({ error: 'City is required' });
      }

      const locations = await db
        .select()
        .from(locationIndex)
        .where(
          state
            ? and(ilike(locationIndex.city, city), ilike(locationIndex.state, state))
            : ilike(locationIndex.city, city)
        )
        .limit(1);

      if (!locations.length) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const location = toLocationRecord(locations[0]);
      const metrics = await getMetricsForPincode(location.pincode);
      const demandScore = computeDemandScore(metrics.totalListings, metrics.totalViews, 0);

      return res.json({
        pincode: location.pincode,
        city: location.city,
        state: location.state,
        latitude: location.latitude,
        longitude: location.longitude,
        totalListings: metrics.totalListings,
        totalViews: metrics.totalViews,
        totalSaves: 0,
        avgPrice: metrics.avgPrice,
        demandScore,
      });
    } catch (error) {
      console.error('Error fetching location metrics:', error);
      return res.status(500).json({ error: 'Failed to fetch location metrics' });
    }
  });

  app.get('/api/location/nearby', async (req, res) => {
    try {
      const { latitude, longitude, radius = 50 } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
      }

      const lat = parseFloat(latitude as string);
      const lon = parseFloat(longitude as string);
      const radiusKm = parseFloat(radius as string);

      if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(radiusKm)) {
        return res.status(400).json({ error: 'Invalid latitude, longitude or radius' });
      }

      const latDelta = radiusKm / 111;
      const lonDelta = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));

      const candidates = await db
        .select()
        .from(locationIndex)
        .where(
          sql`cast(${locationIndex.latitude} as numeric) between ${lat - latDelta} and ${lat + latDelta}
            and cast(${locationIndex.longitude} as numeric) between ${lon - lonDelta} and ${lon + lonDelta}`
        )
        .limit(500);

      const nearby = candidates
        .map((row) => {
          const location = toLocationRecord(row);
          const distance = calculateDistance(lat, lon, location.latitude, location.longitude);
          return { ...location, distanceKm: Number(distance.toFixed(2)) };
        })
        .filter((row) => row.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      return res.json(nearby);
    } catch (error) {
      console.error('Error fetching nearby locations:', error);
      return res.status(500).json({ error: 'Failed to fetch nearby locations' });
    }
  });

  app.get('/api/location/trending', async (req, res) => {
    try {
      const { limit = 5 } = req.query;
      const limitNum = Math.min(parseInt(limit as string, 10) || 5, 20);

      const topPincodes = await db
        .select({
          pincode: listings.pincode,
          totalListings: sql<number>`count(*)`,
          totalViews: sql<number>`coalesce(sum(${listings.viewCount}), 0)`,
          avgPrice: sql<number>`coalesce(avg(cast(${listings.price} as numeric)), 0)`,
        })
        .from(listings)
        .where(
          and(
            eq(listings.isActive, true),
            eq(listings.status, 'active'),
            isNotNull(listings.pincode)
          )
        )
        .groupBy(listings.pincode)
        .orderBy(desc(sql`coalesce(sum(${listings.viewCount}), 0)`), desc(sql`count(*)`))
        .limit(limitNum * 2);

      const metrics: LocationMetrics[] = [];

      for (const row of topPincodes) {
        const pincode = row.pincode;
        if (!pincode) {
          continue;
        }

        const location = await getLocationByPincode(pincode);
        if (!location) {
          continue;
        }

        const totalListings = toNumber(row.totalListings);
        const totalViews = toNumber(row.totalViews);
        const totalSaves = 0;

        metrics.push({
          pincode,
          city: location.city,
          state: location.state,
          latitude: location.latitude,
          longitude: location.longitude,
          totalListings,
          totalViews,
          totalSaves,
          avgPrice: toNumber(row.avgPrice),
          demandScore: computeDemandScore(totalListings, totalViews, totalSaves),
        });
      }

      metrics.sort((a, b) => b.demandScore - a.demandScore);
      return res.json(metrics.slice(0, limitNum));
    } catch (error) {
      console.error('Error fetching trending locations:', error);
      return res.status(500).json({ error: 'Failed to fetch trending locations' });
    }
  });

  app.post('/api/location/update-demand', (_req, res) => {
    return res.status(501).json({
      success: false,
      error: 'Demand update endpoint is deprecated. Metrics are now derived from listing data.',
    });
  });

  app.get('/api/location/pricing/dynamic', async (req, res) => {
    try {
      const { city, state } = req.query;

      if (!city || !state) {
        return res.status(400).json({ error: 'City and state are required' });
      }

      const locations = await db
        .select()
        .from(locationIndex)
        .where(
          and(ilike(locationIndex.city, String(city)), ilike(locationIndex.state, String(state)))
        )
        .limit(1);

      if (!locations.length) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const location = toLocationRecord(locations[0]);
      const metrics = await getMetricsForPincode(location.pincode);
      const demandScore = computeDemandScore(metrics.totalListings, metrics.totalViews, 0);
      const multiplier = 0.8 + (demandScore / 100) * 0.4;

      return res.json({
        city: location.city,
        state: location.state,
        demandScore,
        priceMultiplier: parseFloat(multiplier.toFixed(2)),
        baselinePrice: 199,
        adjustedPrice: Math.round(199 * multiplier),
        explanation:
          demandScore > 85
            ? 'High demand in this location - prices adjusted upward'
            : demandScore < 70
              ? 'Lower demand in this location - lower prices available'
              : 'Standard pricing for this location',
      });
    } catch (error) {
      console.error('Error calculating dynamic pricing:', error);
      return res.status(500).json({ error: 'Failed to calculate dynamic pricing' });
    }
  });
}
