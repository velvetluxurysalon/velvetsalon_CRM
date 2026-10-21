import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const nodeEnv = process.env.NODE_ENV;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined.');
  }

  // Prevent tests from connecting to production.
  if (nodeEnv === 'test' && !uri.includes('/velvet_test')) {
    throw new Error('Safety check failed: Tests must use the velvet_test database.');
  }

  try {
    await mongoose.connect(uri);

    const databaseName = mongoose.connection.name;

    console.log('✦ MongoDB connected →', databaseName);
    console.log('Environment →', nodeEnv);

    if (nodeEnv === 'test' && databaseName !== 'velvet_test') {
      await mongoose.disconnect();
      throw new Error('Connected to the wrong test database.');
    }
  } catch (err) {
    console.error('✖ MongoDB connection failed:', err);
    throw err;
  }
}
