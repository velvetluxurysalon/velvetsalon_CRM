/**
 * Seed initial users into MongoDB.
 * Passwords are hashed automatically by the User model's pre('save') hook.
 *
 * Usage (from apps/api/):
 *   pnpm tsx src/scripts/seed.ts
 *
 * To reset and re-seed:
 *   npx mongosh "<MONGODB_URI>" --eval "db.users.deleteMany({})"
 *   pnpm tsx src/scripts/seed.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/user.model.js';

const SEED_USERS = [
  {
    name:     'Admin User',
    email:    'admin@velvet.in',
    password: 'Admin@123',
    role:     'admin' as const,
  },
  {
    name:     'Receptionist',
    email:    'reception@velvet.in',
    password: 'Staff@123',
    role:     'receptionist' as const,
  },
  {
    name:     'Staff Member',
    email:    'staff@velvet.in',
    password: 'Staff@123',
    role:     'staff' as const,
  },
] as const;

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  await mongoose.connect(uri);
  console.log('✦ Connected to MongoDB:', mongoose.connection.name);

  for (const u of SEED_USERS) {
    const exists = await User.findOne({ email: u.email });

    if (exists) {
      console.log(`  skip     ${u.email}  (already exists)`);
      continue;
    }

    // User.create() triggers the pre('save') hook which hashes the password
    await User.create({ ...u });
    console.log(`  created  ${u.email}  [${u.role}]`);
  }

  await mongoose.disconnect();
  console.log('✦ Seeding complete.');
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});