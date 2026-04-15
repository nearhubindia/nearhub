// Geolocation service for reverse geocoding using GeoJSON boundaries
// Implements point-in-polygon algorithm for pincode detection

import * as fs from 'fs';
import * as path from 'path';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface GeometryPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

interface GeometryMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

type Geometry = GeometryPolygon | GeometryMultiPolygon;

interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    Pincode: string;
    Office_Name: string;
    Division: string;
    Region?: string;
    Circle?: string;
  };
  geometry: Geometry;
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

interface PincodePolygon {
  pincode: string;
  officeName: string;
  division: string;
  region?: string;
  circle?: string;
  polygon: number[][][]; // Ring coordinates [[lon, lat], [lon, lat], ...]
  bbox?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

class GeolocationService {
  private polygons: PincodePolygon[] = [];
  private initialized = false;

  private getFeaturePolygons(geometry: Geometry): number[][][][] {
    if (geometry.type === 'Polygon') {
      return [geometry.coordinates];
    }

    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates;
    }

    return [];
  }

  /**
   * Load GeoJSON file and parse polygon boundaries
   */
  async initialize() {
    try {
      // Support both repo-root cwd and server-folder cwd
      const candidatePaths = [
        path.join(process.cwd(), 'server/data/pincode_geo.geojson'),
        path.join(process.cwd(), 'data/pincode_geo.geojson'),
        path.join(process.cwd(), 'server/features/search/data/pincode_geo.geojson'),
        path.join(process.cwd(), 'features/search/data/pincode_geo.geojson'),
      ];

      const geoJsonPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));

      if (!geoJsonPath) {
        console.error('[Geolocation] GeoJSON file not found. Checked:', candidatePaths);
        return;
      }

      console.log('[Geolocation] Loading GeoJSON file...');
      const startTime = Date.now();

      // Read file as stream and process line by line for memory efficiency
      let fileContent = '';
      let featureCount = 0;

      // Use streaming approach for large files
      const chunkSize = 1024 * 1024; // 1MB chunks
      const fd = fs.openSync(geoJsonPath, 'r');
      const chunk = Buffer.alloc(chunkSize);
      let bytesRead;

      while ((bytesRead = fs.readSync(fd, chunk, 0, chunkSize, null)) > 0) {
        fileContent += chunk.toString('utf8', 0, bytesRead);
      }
      fs.closeSync(fd);

      // Parse GeoJSON
      const geoJson: GeoJsonFeatureCollection = JSON.parse(fileContent);

      if (!geoJson.features) {
        console.error('[Geolocation] Invalid GeoJSON: missing features');
        return;
      }

      console.log(`[Geolocation] Processing ${geoJson.features.length} features...`);

      // Process each feature
      for (const feature of geoJson.features) {
        const pincode = feature.properties.Pincode;
        if (!pincode) continue;

        const polygons = this.getFeaturePolygons(feature.geometry);
        if (!polygons.length) continue;

        for (const polygonCoordinates of polygons) {
          const exteriorRing = polygonCoordinates[0];
          if (!exteriorRing || !exteriorRing.length) continue;

          const polygon: PincodePolygon = {
            pincode,
            officeName: feature.properties.Office_Name || '',
            division: feature.properties.Division || '',
            region: feature.properties.Region,
            circle: feature.properties.Circle,
            polygon: polygonCoordinates,
            bbox: this.calculateBoundingBox(exteriorRing),
          };

          this.polygons.push(polygon);
          featureCount++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[Geolocation] ✅ Loaded ${featureCount} pincode polygons in ${duration}ms`);
      this.initialized = true;
    } catch (error) {
      console.error('[Geolocation] Error loading GeoJSON:', error);
    }
  }

  /**
   * Calculate bounding box for a polygon ring
   */
  private calculateBoundingBox(ring: number[][]): {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  } {
    let minLat = Infinity,
      maxLat = -Infinity;
    let minLon = Infinity,
      maxLon = -Infinity;

    for (const [lon, lat] of ring) {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    }

    return { minLat, maxLat, minLon, maxLon };
  }

  /**
   * Point-in-Polygon algorithm (Ray casting)
   * Returns true if point [lon, lat] is inside polygon
   */
  private isPointInPolygon(point: [number, number], ring: number[][]): boolean {
    const [lon, lat] = point;
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];

      const minX = Math.min(xi, xj);
      const maxX = Math.max(xi, xj);
      const minY = Math.min(yi, yj);
      const maxY = Math.max(yi, yj);
      const cross = (lon - xi) * (yj - yi) - (lat - yi) * (xj - xi);

      if (
        Math.abs(cross) <= 1e-10 &&
        lon >= minX - 1e-10 &&
        lon <= maxX + 1e-10 &&
        lat >= minY - 1e-10 &&
        lat <= maxY + 1e-10
      ) {
        return true;
      }

      const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Reverse geocode coordinates to find pincode
   * Returns pincode information if coordinates fall within a polygon
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    if (!this.initialized) {
      console.warn('[Geolocation] Service not initialized');
      return null;
    }

    const point: [number, number] = [longitude, latitude];

    // First, use bounding box for quick filtering
    for (const polygon of this.polygons) {
      if (!polygon.bbox) continue;

      // Quick bbox check
      if (
        latitude < polygon.bbox.minLat ||
        latitude > polygon.bbox.maxLat ||
        longitude < polygon.bbox.minLon ||
        longitude > polygon.bbox.maxLon
      ) {
        continue;
      }

      // Full point-in-polygon check
      // For Polygon type, first ring is exterior, rest are holes
      const exteriorRing = polygon.polygon[0];
      const isInExterior = this.isPointInPolygon(point, exteriorRing);

      if (!isInExterior) continue;

      // Check if point is in any hole (interior rings)
      let inHole = false;
      for (let i = 1; i < polygon.polygon.length; i++) {
        if (this.isPointInPolygon(point, polygon.polygon[i])) {
          inHole = true;
          break;
        }
      }

      if (!inHole) {
        return polygon.pincode;
      }
    }

    return null;
  }

  /**
   * Get pincode information by coordinates
   * Falls back to nearest pincode if exact match not found
   */
  async getPincodeByCoordinates(
    latitude: number,
    longitude: number
  ): Promise<{ pincode: string; accuracy: 'exact' | 'approximate' } | null> {
    // Try exact match first
    const exactPincode = await this.reverseGeocode(latitude, longitude);
    if (exactPincode) {
      return {
        pincode: exactPincode,
        accuracy: 'exact',
      };
    }

    // Find nearest pincode center as fallback
    let nearestPincode: string | null = null;
    let minDistance = Infinity;

    for (const polygon of this.polygons) {
      if (!polygon.bbox) continue;

      // Calculate center of bounding box
      const centerLat = (polygon.bbox.minLat + polygon.bbox.maxLat) / 2;
      const centerLon = (polygon.bbox.minLon + polygon.bbox.maxLon) / 2;

      const distance = this.calculateDistance(latitude, longitude, centerLat, centerLon);

      if (distance < minDistance) {
        minDistance = distance;
        nearestPincode = polygon.pincode;
      }
    }

    if (nearestPincode && minDistance < 5) {
      // Within 5km
      return {
        pincode: nearestPincode,
        accuracy: 'approximate',
      };
    }

    return null;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * Returns distance in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get initialization status
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get polygon count
   */
  getPolygonCount(): number {
    return this.polygons.length;
  }

  searchLocations(
    query: string,
    limit: number
  ): Array<{
    pincode: string;
    city: string;
    state: string;
    district: string;
    latitude: number;
    longitude: number;
    region: string;
  }> {
    if (!this.initialized || query.trim().length < 2) {
      return [];
    }

    const normalizeName = (value: string): string => {
      const inParens = value.match(/\(([^)]+)\)/)?.[1]?.trim();
      if (inParens) {
        return inParens;
      }
      return value
        .replace(/\s+(S\.O|B\.O|H\.O|SO|BO|HO)$/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    };

    const needle = query.toLowerCase();
    const unique = new Map<
      string,
      {
        pincode: string;
        city: string;
        state: string;
        district: string;
        latitude: number;
        longitude: number;
        region: string;
        score: number;
      }
    >();

    for (const polygon of this.polygons) {
      const city = normalizeName(polygon.officeName);
      if (!city || !polygon.bbox) {
        continue;
      }

      const cityLower = city.toLowerCase();
      const districtLower = polygon.division.toLowerCase();

      let score = 0;
      if (cityLower === needle) {
        score = 120;
      } else if (cityLower.startsWith(needle)) {
        score = 100;
      } else if (cityLower.includes(needle)) {
        score = 80;
      } else if (districtLower.startsWith(needle)) {
        score = 60;
      } else if (districtLower.includes(needle)) {
        score = 40;
      }

      if (score === 0) {
        continue;
      }

      const key = `${city.toLowerCase()}|${(polygon.circle || '').toLowerCase()}`;
      const centerLat = (polygon.bbox.minLat + polygon.bbox.maxLat) / 2;
      const centerLon = (polygon.bbox.minLon + polygon.bbox.maxLon) / 2;

      const existing = unique.get(key);
      if (!existing || score > existing.score) {
        unique.set(key, {
          pincode: polygon.pincode,
          city,
          state: polygon.circle?.trim() || '',
          district: polygon.division,
          latitude: centerLat,
          longitude: centerLon,
          region: polygon.region?.trim() || '',
          score,
        });
      }
    }

    return Array.from(unique.values())
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.city.length - b.city.length;
      })
      .slice(0, limit)
      .map(({ score: _score, ...result }) => result);
  }
}

// Export singleton instance
export const geolocationService = new GeolocationService();
export { GeolocationService };
