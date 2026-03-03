import { db } from './data/db';
import { listings } from './features/admin/models/admin-settings';

async function checkListings() {
  try {
    const result = await db.select().from(listings).limit(10);
    console.log(`\n✅ Total listings in database: ${result.length}`);
    
    if (result.length > 0) {
      console.log('\n📍 Sample listings:');
      result.forEach((listing, index) => {
        console.log(`\n${index + 1}. ${listing.title}`);
        console.log(`   Location: ${listing.location}`);
        console.log(`   Coordinates: (${listing.latitude}, ${listing.longitude})`);
        console.log(`   Price: ₹${listing.price}`);
        console.log(`   Category: ${listing.category}`);
      });
    } else {
      console.log('\n⚠️  No listings found in database!');
      console.log('You may need to seed the database with sample data.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking listings:', error);
    process.exit(1);
  }
}

checkListings();
