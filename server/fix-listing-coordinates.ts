import { db } from './data/db';
import { listings } from './features/admin/models/admin-settings';
import { eq } from 'drizzle-orm';

// City coordinates for Indian cities
const cityCoordinates: Record<string, { lat: number; lon: number }> = {
  'Hyderabad': { lat: 17.385044, lon: 78.486671 },
  'Hyderabad, Telangana': { lat: 17.385044, lon: 78.486671 },
  'Hyderabad, India': { lat: 17.385044, lon: 78.486671 },
  'Bangalore': { lat: 12.971599, lon: 77.594566 },
  'Bangalore, India': { lat: 12.971599, lon: 77.594566 },
  'Delhi': { lat: 28.704059, lon: 77.102490 },
  'Delhi, India': { lat: 28.704059, lon: 77.102490 },
  'Chennai': { lat: 13.082680, lon: 80.270718 },
  'Chennai, India': { lat: 13.082680, lon: 80.270718 },
  'Mumbai': { lat: 19.076090, lon: 72.877426 },
  'Mumbai, India': { lat: 19.076090, lon: 72.877426 },
  'Kolkata': { lat: 22.572646, lon: 88.363895 },
  'Kolkata, India': { lat: 22.572646, lon: 88.363895 },
  'Pune': { lat: 18.520430, lon: 73.856743 },
  'Pune, India': { lat: 18.520430, lon: 73.856743 },
};

async function updateListingCoordinates() {
  try {
    console.log('\n🔄 Updating listing coordinates...\n');

    const allListings = await db.select().from(listings);
    let updatedCount = 0;

    for (const listing of allListings) {
      const city = listing.location?.trim() || '';
      const coords = cityCoordinates[city];

      if (coords && (listing.latitude === null || listing.longitude === null)) {
        await db
          .update(listings)
          .set({
            latitude: coords.lat.toString(),
            longitude: coords.lon.toString(),
          })
          .where(eq(listings.id, listing.id));

        console.log(`✅ Updated "${listing.title}" (${city}) -> (${coords.lat}, ${coords.lon})`);
        updatedCount++;
      }
    }

    console.log(`\n✨ Successfully updated ${updatedCount} listings with coordinates!`);
    
    // Verify the updates
    const updated = await db.select().from(listings).limit(5);
    console.log('\n📍 Sample updated listings:');
    updated.forEach((l, i) => {
      console.log(`${i + 1}. ${l.title} - ${l.location} (${l.latitude}, ${l.longitude})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating coordinates:', error);
    process.exit(1);
  }
}

updateListingCoordinates();
