// Indian pincode database with location data
// This maps pincodes to cities, states, coordinates, and demand metrics

export interface LocationData {
  pincode: string;
  city: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  region: string;
}

export interface CityDemandMetrics {
  city: string;
  state: string;
  totalListings: number;
  totalViews: number;
  totalSaves: number;
  avgPrice: number;
  demandScore: number; // 0-100, calculated from listings/views/saves
}

// Major Indian cities with coordinates (from pincode database)
export const MAJOR_CITIES: LocationData[] = [
  {
    pincode: '500001',
    city: 'Hyderabad',
    state: 'Telangana',
    district: 'HYDERABAD',
    latitude: 17.385,
    longitude: 78.4867,
    region: 'South',
  },
  {
    pincode: '400001',
    city: 'Mumbai',
    state: 'Maharashtra',
    district: 'MUMBAI',
    latitude: 19.076,
    longitude: 72.8777,
    region: 'West',
  },
  {
    pincode: '560001',
    city: 'Bangalore',
    state: 'Karnataka',
    district: 'BENGALURU',
    latitude: 12.9716,
    longitude: 77.5946,
    region: 'South',
  },
  {
    pincode: '700001',
    city: 'Kolkata',
    state: 'West Bengal',
    district: 'KOLKATA',
    latitude: 22.5726,
    longitude: 88.3639,
    region: 'East',
  },
  {
    pincode: '110001',
    city: 'Delhi',
    state: 'Delhi',
    district: 'CENTRAL DELHI',
    latitude: 28.7041,
    longitude: 77.1025,
    region: 'North',
  },
  {
    pincode: '600001',
    city: 'Chennai',
    state: 'Tamil Nadu',
    district: 'CHENNAI',
    latitude: 13.0827,
    longitude: 80.2707,
    region: 'South',
  },
  {
    pincode: '380001',
    city: 'Ahmedabad',
    state: 'Gujarat',
    district: 'AHMEDABAD',
    latitude: 23.0225,
    longitude: 72.5714,
    region: 'West',
  },
  {
    pincode: '302001',
    city: 'Jaipur',
    state: 'Rajasthan',
    district: 'JAIPUR',
    latitude: 26.9124,
    longitude: 75.7873,
    region: 'North',
  },
  {
    pincode: '411001',
    city: 'Pune',
    state: 'Maharashtra',
    district: 'PUNE',
    latitude: 18.5204,
    longitude: 73.8567,
    region: 'West',
  },
  {
    pincode: '360001',
    city: 'Rajkot',
    state: 'Gujarat',
    district: 'RAJKOT',
    latitude: 22.3039,
    longitude: 70.8022,
    region: 'West',
  },
];

// Demo demand metrics per city (can be updated from real data)
export const CITY_DEMAND: Record<string, CityDemandMetrics> = {
  'Hyderabad-Telangana': {
    city: 'Hyderabad',
    state: 'Telangana',
    totalListings: 1250,
    totalViews: 45000,
    totalSaves: 3200,
    avgPrice: 45000,
    demandScore: 85,
  },
  'Mumbai-Maharashtra': {
    city: 'Mumbai',
    state: 'Maharashtra',
    totalListings: 3450,
    totalViews: 125000,
    totalSaves: 8900,
    avgPrice: 75000,
    demandScore: 95,
  },
  'Bangalore-Karnataka': {
    city: 'Bangalore',
    state: 'Karnataka',
    totalListings: 2800,
    totalViews: 98000,
    totalSaves: 6500,
    avgPrice: 65000,
    demandScore: 92,
  },
  'Delhi-Delhi': {
    city: 'Delhi',
    state: 'Delhi',
    totalListings: 2200,
    totalViews: 87000,
    totalSaves: 5800,
    avgPrice: 55000,
    demandScore: 88,
  },
  'Chennai-Tamil Nadu': {
    city: 'Chennai',
    state: 'Tamil Nadu',
    totalListings: 1100,
    totalViews: 38000,
    totalSaves: 2400,
    avgPrice: 38000,
    demandScore: 72,
  },
};

/**
 * Get city from coordinates using nearest major city
 * @param latitude User's latitude
 * @param longitude User's longitude
 * @returns Nearest city location
 */
export function getCityFromCoordinates(latitude: number, longitude: number): LocationData {
  let nearest = MAJOR_CITIES[0];
  let minDistance = Infinity;

  for (const city of MAJOR_CITIES) {
    const distance = calculateDistance(latitude, longitude, city.latitude, city.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = city;
    }
  }

  return nearest;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function isValidCoordinatePair(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Returns the direct distance by default, but defensively recovers from
 * accidentally swapped latitude/longitude pairs when that interpretation is
 * dramatically more plausible than the original.
 */
export function calculateBestDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!isValidCoordinatePair(lat1, lon1) || !isValidCoordinatePair(lat2, lon2)) {
    return Number.NaN;
  }

  const directDistance = calculateDistance(lat1, lon1, lat2, lon2);
  const candidateDistances = [directDistance];

  if (isValidCoordinatePair(lon1, lat1)) {
    candidateDistances.push(calculateDistance(lon1, lat1, lat2, lon2));
  }

  if (isValidCoordinatePair(lon2, lat2)) {
    candidateDistances.push(calculateDistance(lat1, lon1, lon2, lat2));
  }

  if (isValidCoordinatePair(lon1, lat1) && isValidCoordinatePair(lon2, lat2)) {
    candidateDistances.push(calculateDistance(lon1, lat1, lon2, lat2));
  }

  const bestDistance = candidateDistances.reduce((smallest, current) =>
    current < smallest ? current : smallest
  );

  if (
    directDistance > 1000 &&
    Number.isFinite(bestDistance) &&
    bestDistance < directDistance * 0.25 &&
    bestDistance <= 500
  ) {
    return bestDistance;
  }

  return directDistance;
}

/**
 * Check whether a coordinate pair can be used for distance calculations.
 * We treat 0,0 as invalid because the app uses it as a fallback for missing data.
 */
export function hasMeaningfulCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  return (
    Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0)
  );
}

export function formatDistanceAway(distanceKm?: number): string {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) {
    return 'Distance unavailable';
  }
  if (distanceKm < 1) {
    return '<1 km away';
  }
  return `${Math.round(distanceKm)} km away`;
}

/**
 * Get demand-adjusted price multiplier for a city
 * @param city City name
 * @param state State name
 * @returns Price multiplier (1.0 = baseline, 1.2 = 20% higher)
 */
export function getDemandMultiplier(city: string, state: string): number {
  const key = `${city}-${state}`;
  const metrics = CITY_DEMAND[key];

  if (!metrics) return 1.0; // Default multiplier for unknown cities

  // Multiplier based on demand score (50-100 score → 0.8-1.2 multiplier)
  return 0.8 + (metrics.demandScore / 100) * 0.4;
}

/**
 * Get trending cities by demand
 * @returns Top 5 cities by demand score
 */
export function getTrendingCities(): CityDemandMetrics[] {
  return Object.values(CITY_DEMAND)
    .sort((a, b) => b.demandScore - a.demandScore)
    .slice(0, 5);
}

/**
 * Check if a pincode exists in our database
 * @param pincode Indian pincode (6 digits)
 * @returns Location data if found, null otherwise
 */
export function getPincodeLocation(pincode: string): LocationData | null {
  // Match against major cities first
  let city = MAJOR_CITIES.find((c) => c.pincode === pincode);
  if (city) return city;

  // Extended pincode database for common areas
  const EXTENDED_PINCODES: LocationData[] = [
    // Hyderabad, Telangana
    {
      pincode: '500001',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500002',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500003',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500004',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500005',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500009',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500010',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500016',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500017',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500018',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500036',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500038',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '500044',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '501101',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '501501',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },
    {
      pincode: '502001',
      city: 'Hyderabad',
      state: 'Telangana',
      district: 'HYDERABAD',
      latitude: 17.385,
      longitude: 78.4867,
      region: 'South',
    },

    // Tirupati & Chittoor, Andhra Pradesh
    {
      pincode: '517001',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      district: 'CHITTOOR',
      latitude: 13.1939,
      longitude: 79.8965,
      region: 'South',
    },
    {
      pincode: '517002',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      district: 'CHITTOOR',
      latitude: 13.1939,
      longitude: 79.8965,
      region: 'South',
    },
    {
      pincode: '517003',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      district: 'CHITTOOR',
      latitude: 13.1939,
      longitude: 79.8965,
      region: 'South',
    },
    {
      pincode: '517501',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      district: 'CHITTOOR',
      latitude: 13.1939,
      longitude: 79.8965,
      region: 'South',
    },
    {
      pincode: '518001',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      district: 'CHITTOOR',
      latitude: 13.1939,
      longitude: 79.8965,
      region: 'South',
    },
    {
      pincode: '518003',
      city: 'Kurnool',
      state: 'Andhra Pradesh',
      district: 'KURNOOL',
      latitude: 15.8281,
      longitude: 78.8353,
      region: 'South',
    },
    {
      pincode: '518004',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      district: 'CHITTOOR',
      latitude: 13.1939,
      longitude: 79.8965,
      region: 'South',
    },
    {
      pincode: '518501',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      district: 'CHITTOOR',
      latitude: 13.1939,
      longitude: 79.8965,
      region: 'South',
    },

    // Mumbai, Maharashtra
    {
      pincode: '400001',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400002',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400003',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400004',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400005',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400006',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400007',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400008',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400009',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400010',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400011',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400012',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400013',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400014',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400015',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },
    {
      pincode: '400016',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'MUMBAI',
      latitude: 19.076,
      longitude: 72.8777,
      region: 'West',
    },

    // Bangalore, Karnataka
    {
      pincode: '560001',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560002',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560003',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560004',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560005',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560006',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560007',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560008',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560009',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560010',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560011',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560012',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560013',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560034',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560035',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },
    {
      pincode: '560038',
      city: 'Bangalore',
      state: 'Karnataka',
      district: 'BENGALURU',
      latitude: 12.9716,
      longitude: 77.5946,
      region: 'South',
    },

    // Delhi
    {
      pincode: '110001',
      city: 'Delhi',
      state: 'Delhi',
      district: 'CENTRAL DELHI',
      latitude: 28.7041,
      longitude: 77.1025,
      region: 'North',
    },
    {
      pincode: '110002',
      city: 'Delhi',
      state: 'Delhi',
      district: 'CENTRAL DELHI',
      latitude: 28.7041,
      longitude: 77.1025,
      region: 'North',
    },
    {
      pincode: '110003',
      city: 'Delhi',
      state: 'Delhi',
      district: 'SOUTH DELHI',
      latitude: 28.5244,
      longitude: 77.1855,
      region: 'North',
    },
    {
      pincode: '110004',
      city: 'Delhi',
      state: 'Delhi',
      district: 'SOUTH DELHI',
      latitude: 28.5244,
      longitude: 77.1855,
      region: 'North',
    },
    {
      pincode: '110005',
      city: 'Delhi',
      state: 'Delhi',
      district: 'SOUTH DELHI',
      latitude: 28.5244,
      longitude: 77.1855,
      region: 'North',
    },
    {
      pincode: '110006',
      city: 'Delhi',
      state: 'Delhi',
      district: 'SOUTH DELHI',
      latitude: 28.5244,
      longitude: 77.1855,
      region: 'North',
    },
    {
      pincode: '110007',
      city: 'Delhi',
      state: 'Delhi',
      district: 'SOUTH DELHI',
      latitude: 28.5244,
      longitude: 77.1855,
      region: 'North',
    },
    {
      pincode: '110008',
      city: 'Delhi',
      state: 'Delhi',
      district: 'SOUTH DELHI',
      latitude: 28.5244,
      longitude: 77.1855,
      region: 'North',
    },
    {
      pincode: '110009',
      city: 'Delhi',
      state: 'Delhi',
      district: 'NEW DELHI',
      latitude: 28.6332,
      longitude: 77.2197,
      region: 'North',
    },
    {
      pincode: '110011',
      city: 'Delhi',
      state: 'Delhi',
      district: 'EAST DELHI',
      latitude: 28.6328,
      longitude: 77.296,
      region: 'North',
    },
    {
      pincode: '110012',
      city: 'Delhi',
      state: 'Delhi',
      district: 'EAST DELHI',
      latitude: 28.6328,
      longitude: 77.296,
      region: 'North',
    },
    {
      pincode: '110013',
      city: 'Delhi',
      state: 'Delhi',
      district: 'EAST DELHI',
      latitude: 28.6328,
      longitude: 77.296,
      region: 'North',
    },
    {
      pincode: '110014',
      city: 'Delhi',
      state: 'Delhi',
      district: 'EAST DELHI',
      latitude: 28.6328,
      longitude: 77.296,
      region: 'North',
    },
    {
      pincode: '110015',
      city: 'Delhi',
      state: 'Delhi',
      district: 'EAST DELHI',
      latitude: 28.6328,
      longitude: 77.296,
      region: 'North',
    },
    {
      pincode: '110016',
      city: 'Delhi',
      state: 'Delhi',
      district: 'NORTH DELHI',
      latitude: 28.7523,
      longitude: 77.2317,
      region: 'North',
    },

    // Chennai, Tamil Nadu
    {
      pincode: '600001',
      city: 'Chennai',
      state: 'Tamil Nadu',
      district: 'CHENNAI',
      latitude: 13.0827,
      longitude: 80.2707,
      region: 'South',
    },
    {
      pincode: '600002',
      city: 'Chennai',
      state: 'Tamil Nadu',
      district: 'CHENNAI',
      latitude: 13.0827,
      longitude: 80.2707,
      region: 'South',
    },
    {
      pincode: '600003',
      city: 'Chennai',
      state: 'Tamil Nadu',
      district: 'CHENNAI',
      latitude: 13.0827,
      longitude: 80.2707,
      region: 'South',
    },
    {
      pincode: '600004',
      city: 'Chennai',
      state: 'Tamil Nadu',
      district: 'CHENNAI',
      latitude: 13.0827,
      longitude: 80.2707,
      region: 'South',
    },
    {
      pincode: '600005',
      city: 'Chennai',
      state: 'Tamil Nadu',
      district: 'CHENNAI',
      latitude: 13.0827,
      longitude: 80.2707,
      region: 'South',
    },
    {
      pincode: '600006',
      city: 'Chennai',
      state: 'Tamil Nadu',
      district: 'CHENNAI',
      latitude: 13.0827,
      longitude: 80.2707,
      region: 'South',
    },
    {
      pincode: '600007',
      city: 'Chennai',
      state: 'Tamil Nadu',
      district: 'CHENNAI',
      latitude: 13.0827,
      longitude: 80.2707,
      region: 'South',
    },
    {
      pincode: '600008',
      city: 'Chennai',
      state: 'Tamil Nadu',
      district: 'CHENNAI',
      latitude: 13.0827,
      longitude: 80.2707,
      region: 'South',
    },
    {
      pincode: '600009',
      city: 'Chennai',
      state: 'Tamil Nadu',
      district: 'CHENNAI',
      latitude: 13.0827,
      longitude: 80.2707,
      region: 'South',
    },
    {
      pincode: '600010',
      city: 'Chennai',
      state: 'Tamil Nadu',
      district: 'CHENNAI',
      latitude: 13.0827,
      longitude: 80.2707,
      region: 'South',
    },

    // Ahmedabad, Gujarat
    {
      pincode: '380001',
      city: 'Ahmedabad',
      state: 'Gujarat',
      district: 'AHMEDABAD',
      latitude: 23.0225,
      longitude: 72.5714,
      region: 'West',
    },
    {
      pincode: '380002',
      city: 'Ahmedabad',
      state: 'Gujarat',
      district: 'AHMEDABAD',
      latitude: 23.0225,
      longitude: 72.5714,
      region: 'West',
    },
    {
      pincode: '380003',
      city: 'Ahmedabad',
      state: 'Gujarat',
      district: 'AHMEDABAD',
      latitude: 23.0225,
      longitude: 72.5714,
      region: 'West',
    },
    {
      pincode: '380004',
      city: 'Ahmedabad',
      state: 'Gujarat',
      district: 'AHMEDABAD',
      latitude: 23.0225,
      longitude: 72.5714,
      region: 'West',
    },
    {
      pincode: '380005',
      city: 'Ahmedabad',
      state: 'Gujarat',
      district: 'AHMEDABAD',
      latitude: 23.0225,
      longitude: 72.5714,
      region: 'West',
    },
    {
      pincode: '380006',
      city: 'Ahmedabad',
      state: 'Gujarat',
      district: 'AHMEDABAD',
      latitude: 23.0225,
      longitude: 72.5714,
      region: 'West',
    },
    {
      pincode: '380015',
      city: 'Ahmedabad',
      state: 'Gujarat',
      district: 'AHMEDABAD',
      latitude: 23.0225,
      longitude: 72.5714,
      region: 'West',
    },

    // Pune, Maharashtra
    {
      pincode: '411001',
      city: 'Pune',
      state: 'Maharashtra',
      district: 'PUNE',
      latitude: 18.5204,
      longitude: 73.8567,
      region: 'West',
    },
    {
      pincode: '411002',
      city: 'Pune',
      state: 'Maharashtra',
      district: 'PUNE',
      latitude: 18.5204,
      longitude: 73.8567,
      region: 'West',
    },
    {
      pincode: '411003',
      city: 'Pune',
      state: 'Maharashtra',
      district: 'PUNE',
      latitude: 18.5204,
      longitude: 73.8567,
      region: 'West',
    },
    {
      pincode: '411004',
      city: 'Pune',
      state: 'Maharashtra',
      district: 'PUNE',
      latitude: 18.5204,
      longitude: 73.8567,
      region: 'West',
    },
    {
      pincode: '411005',
      city: 'Pune',
      state: 'Maharashtra',
      district: 'PUNE',
      latitude: 18.5204,
      longitude: 73.8567,
      region: 'West',
    },

    // Jaipur, Rajasthan
    {
      pincode: '302001',
      city: 'Jaipur',
      state: 'Rajasthan',
      district: 'JAIPUR',
      latitude: 26.9124,
      longitude: 75.7873,
      region: 'North',
    },
    {
      pincode: '302002',
      city: 'Jaipur',
      state: 'Rajasthan',
      district: 'JAIPUR',
      latitude: 26.9124,
      longitude: 75.7873,
      region: 'North',
    },
    {
      pincode: '302003',
      city: 'Jaipur',
      state: 'Rajasthan',
      district: 'JAIPUR',
      latitude: 26.9124,
      longitude: 75.7873,
      region: 'North',
    },
    {
      pincode: '302004',
      city: 'Jaipur',
      state: 'Rajasthan',
      district: 'JAIPUR',
      latitude: 26.9124,
      longitude: 75.7873,
      region: 'North',
    },
    {
      pincode: '302005',
      city: 'Jaipur',
      state: 'Rajasthan',
      district: 'JAIPUR',
      latitude: 26.9124,
      longitude: 75.7873,
      region: 'North',
    },

    // Kolkata, West Bengal
    {
      pincode: '700001',
      city: 'Kolkata',
      state: 'West Bengal',
      district: 'KOLKATA',
      latitude: 22.5726,
      longitude: 88.3639,
      region: 'East',
    },
    {
      pincode: '700002',
      city: 'Kolkata',
      state: 'West Bengal',
      district: 'KOLKATA',
      latitude: 22.5726,
      longitude: 88.3639,
      region: 'East',
    },
    {
      pincode: '700003',
      city: 'Kolkata',
      state: 'West Bengal',
      district: 'KOLKATA',
      latitude: 22.5726,
      longitude: 88.3639,
      region: 'East',
    },
    {
      pincode: '700004',
      city: 'Kolkata',
      state: 'West Bengal',
      district: 'KOLKATA',
      latitude: 22.5726,
      longitude: 88.3639,
      region: 'East',
    },
    {
      pincode: '700005',
      city: 'Kolkata',
      state: 'West Bengal',
      district: 'KOLKATA',
      latitude: 22.5726,
      longitude: 88.3639,
      region: 'East',
    },

    // Rajkot, Gujarat
    {
      pincode: '360001',
      city: 'Rajkot',
      state: 'Gujarat',
      district: 'RAJKOT',
      latitude: 22.3039,
      longitude: 70.8022,
      region: 'West',
    },
    {
      pincode: '360002',
      city: 'Rajkot',
      state: 'Gujarat',
      district: 'RAJKOT',
      latitude: 22.3039,
      longitude: 70.8022,
      region: 'West',
    },
    {
      pincode: '360003',
      city: 'Rajkot',
      state: 'Gujarat',
      district: 'RAJKOT',
      latitude: 22.3039,
      longitude: 70.8022,
      region: 'West',
    },
    {
      pincode: '360004',
      city: 'Rajkot',
      state: 'Gujarat',
      district: 'RAJKOT',
      latitude: 22.3039,
      longitude: 70.8022,
      region: 'West',
    },
    {
      pincode: '360005',
      city: 'Rajkot',
      state: 'Gujarat',
      district: 'RAJKOT',
      latitude: 22.3039,
      longitude: 70.8022,
      region: 'West',
    },

    // Indore, Madhya Pradesh
    {
      pincode: '452001',
      city: 'Indore',
      state: 'Madhya Pradesh',
      district: 'INDORE',
      latitude: 22.7196,
      longitude: 75.8577,
      region: 'Central',
    },
    {
      pincode: '452002',
      city: 'Indore',
      state: 'Madhya Pradesh',
      district: 'INDORE',
      latitude: 22.7196,
      longitude: 75.8577,
      region: 'Central',
    },
    {
      pincode: '452003',
      city: 'Indore',
      state: 'Madhya Pradesh',
      district: 'INDORE',
      latitude: 22.7196,
      longitude: 75.8577,
      region: 'Central',
    },
    {
      pincode: '452009',
      city: 'Indore',
      state: 'Madhya Pradesh',
      district: 'INDORE',
      latitude: 22.7196,
      longitude: 75.8577,
      region: 'Central',
    },

    // Vadodara, Gujarat
    {
      pincode: '390001',
      city: 'Vadodara',
      state: 'Gujarat',
      district: 'VADODARA',
      latitude: 22.3072,
      longitude: 73.1812,
      region: 'West',
    },
    {
      pincode: '390002',
      city: 'Vadodara',
      state: 'Gujarat',
      district: 'VADODARA',
      latitude: 22.3072,
      longitude: 73.1812,
      region: 'West',
    },
    {
      pincode: '390003',
      city: 'Vadodara',
      state: 'Gujarat',
      district: 'VADODARA',
      latitude: 22.3072,
      longitude: 73.1812,
      region: 'West',
    },
    {
      pincode: '390004',
      city: 'Vadodara',
      state: 'Gujarat',
      district: 'VADODARA',
      latitude: 22.3072,
      longitude: 73.1812,
      region: 'West',
    },

    // Ludhiana, Punjab
    {
      pincode: '141001',
      city: 'Ludhiana',
      state: 'Punjab',
      district: 'LUDHIANA',
      latitude: 30.901,
      longitude: 75.8573,
      region: 'North',
    },
    {
      pincode: '141002',
      city: 'Ludhiana',
      state: 'Punjab',
      district: 'LUDHIANA',
      latitude: 30.901,
      longitude: 75.8573,
      region: 'North',
    },
    {
      pincode: '141003',
      city: 'Ludhiana',
      state: 'Punjab',
      district: 'LUDHIANA',
      latitude: 30.901,
      longitude: 75.8573,
      region: 'North',
    },
    {
      pincode: '141004',
      city: 'Ludhiana',
      state: 'Punjab',
      district: 'LUDHIANA',
      latitude: 30.901,
      longitude: 75.8573,
      region: 'North',
    },

    // Vishakapatnam, Andhra Pradesh
    {
      pincode: '530001',
      city: 'Vishakapatnam',
      state: 'Andhra Pradesh',
      district: 'VISAKHAPATNAM',
      latitude: 17.6869,
      longitude: 83.2185,
      region: 'South',
    },
    {
      pincode: '530002',
      city: 'Vishakapatnam',
      state: 'Andhra Pradesh',
      district: 'VISAKHAPATNAM',
      latitude: 17.6869,
      longitude: 83.2185,
      region: 'South',
    },
    {
      pincode: '530003',
      city: 'Vishakapatnam',
      state: 'Andhra Pradesh',
      district: 'VISAKHAPATNAM',
      latitude: 17.6869,
      longitude: 83.2185,
      region: 'South',
    },

    // Kochi, Kerala
    {
      pincode: '682001',
      city: 'Kochi',
      state: 'Kerala',
      district: 'ERNAKULAM',
      latitude: 9.9312,
      longitude: 76.2673,
      region: 'South',
    },
    {
      pincode: '682002',
      city: 'Kochi',
      state: 'Kerala',
      district: 'ERNAKULAM',
      latitude: 9.9312,
      longitude: 76.2673,
      region: 'South',
    },
    {
      pincode: '682011',
      city: 'Kochi',
      state: 'Kerala',
      district: 'ERNAKULAM',
      latitude: 9.9312,
      longitude: 76.2673,
      region: 'South',
    },
    {
      pincode: '682012',
      city: 'Kochi',
      state: 'Kerala',
      district: 'ERNAKULAM',
      latitude: 9.9312,
      longitude: 76.2673,
      region: 'South',
    },

    // Lucknow, Uttar Pradesh
    {
      pincode: '226001',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      district: 'LUCKNOW',
      latitude: 26.8467,
      longitude: 80.9462,
      region: 'North',
    },
    {
      pincode: '226002',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      district: 'LUCKNOW',
      latitude: 26.8467,
      longitude: 80.9462,
      region: 'North',
    },
    {
      pincode: '226003',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      district: 'LUCKNOW',
      latitude: 26.8467,
      longitude: 80.9462,
      region: 'North',
    },

    // Surat, Gujarat
    {
      pincode: '395001',
      city: 'Surat',
      state: 'Gujarat',
      district: 'SURAT',
      latitude: 21.17,
      longitude: 72.8302,
      region: 'West',
    },
    {
      pincode: '395002',
      city: 'Surat',
      state: 'Gujarat',
      district: 'SURAT',
      latitude: 21.17,
      longitude: 72.8302,
      region: 'West',
    },
    {
      pincode: '395003',
      city: 'Surat',
      state: 'Gujarat',
      district: 'SURAT',
      latitude: 21.17,
      longitude: 72.8302,
      region: 'West',
    },
    {
      pincode: '395004',
      city: 'Surat',
      state: 'Gujarat',
      district: 'SURAT',
      latitude: 21.17,
      longitude: 72.8302,
      region: 'West',
    },
    {
      pincode: '395005',
      city: 'Surat',
      state: 'Gujarat',
      district: 'SURAT',
      latitude: 21.17,
      longitude: 72.8302,
      region: 'West',
    },
  ];

  // Search in extended database
  return EXTENDED_PINCODES.find((c) => c.pincode === pincode) || null;
}
