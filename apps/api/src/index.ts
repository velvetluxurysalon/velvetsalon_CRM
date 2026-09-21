import 'dotenv/config';
import { app } from './app.js';
import { connectDB } from './db/db.js';

const PORT = process.env['PORT'] ?? 3001;

await connectDB(); // ← this was missing

app.listen(PORT, () => {
  console.log(`[api] Server running on http://localhost:${PORT.toString()}`);
});