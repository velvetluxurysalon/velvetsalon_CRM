import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { Customer } from '../models/customer.model.js';

const PHONE = '9345816672';

async function main() {
  const uri = process.env.MONGODB_URI;   // ← fixed: was MONGO_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not set — check your .env file path');
  }

  await mongoose.connect(uri);

  const customer = await Customer.findOne({ phone: PHONE });
  if (!customer) { console.log('not found'); return; }

  console.log('BEFORE visits:', customer.visits.map(v => ({ date: v.date, total: v.total, services: v.services })));

  const realServiceNames = new Set(
    customer.visits.filter(v => v.total > 0).flatMap(v => v.services)
  );

  customer.visits = customer.visits.filter(v => {
    const isPhantom = v.total === 0 && v.services.some(s => realServiceNames.has(s));
    if (isPhantom) console.log('Dropping phantom visit:', v.date, v.services);
    return !isPhantom;
  }) as never;

  customer.visitCount = customer.visits.length;
  customer.totalSpent = customer.visits.reduce((sum, v) => sum + v.total, 0);
  customer.lastVisit = customer.visits.map(v => v.date).sort().at(-1) ?? customer.lastVisit;

  await customer.save();

  console.log('AFTER visits:', customer.visits.length, 'visitCount:', customer.visitCount, 'totalSpent:', customer.totalSpent);
  await mongoose.disconnect();
}

main().catch(console.error);