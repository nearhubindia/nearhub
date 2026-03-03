#!/usr/bin/env tsx
/**
 * Database Seeding Script
 * Seeds test users into the database
 * 
 * Usage: npm run seed:users
 */

import '../data/env';
import { db } from '../data/db';
import { users } from '../features/users/models/users';
import seedUsersData from '../data/seed-users.json' assert { type: 'json' };
import bcrypt from 'bcryptjs';

async function seedUsers() {
  console.log('[Seed] Starting user seeding...');
  
  try {
    // Check existing users
    const existingUsers = await db.select().from(users);
    console.log(`[Seed] Found ${existingUsers.length} existing users`);
    
    if (existingUsers.length > 0) {
      console.log('[Seed] Database already has users. Skipping user seed.');
      return;
    }

    // Hash passwords and insert users
    console.log(`[Seed] Inserting ${seedUsersData.length} test users...`);
    
    for (const userData of seedUsersData) {
      // Generate a simple hash for demo purposes
      const hashedPassword = await bcrypt.hash(userData.password || 'password123', 10);
      
      try {
        await db.insert(users).values({
          username: userData.username,
          password: hashedPassword,
          mobile: userData.mobile,
          location: userData.location,
        });
        console.log(`[Seed] ✓ Created user: ${userData.username}`);
      } catch (error: any) {
        // Skip duplicate username errors
        if (error.code === '23505') {
          console.log(`[Seed] ⚠️  User already exists: ${userData.username}`);
        } else {
          console.error(`[Seed] Error creating user ${userData.username}:`, error.message);
        }
      }
    }
    
    console.log('[Seed] ✅ User seeding completed');
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    process.exit(1);
  }
}

async function main() {
  try {
    await seedUsers();
    console.log('[Seed] All seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Fatal error:', error);
    process.exit(1);
  }
}

main();
