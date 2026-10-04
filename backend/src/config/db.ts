import mongoose from 'mongoose';
import dns from 'dns';

/**
 * DNS STRATEGY
 * ─────────────
 * Some local/ISP DNS resolvers cannot process MongoDB SRV (mongodb+srv://)
 * records. On Render and most cloud platforms this is not an issue — their DNS
 * resolvers fully support SRV. On those platforms the setServers() call is
 * harmless (Google DNS responds the same as the platform DNS for Atlas).
 *
 * We always set Google Public DNS + OpenDNS as the resolver list.
 * This is safe for production:
 *   - It only affects DNS lookups inside this Node.js process.
 *   - It does not affect the host system.
 *   - It does not leak credentials.
 *   - It ensures SRV resolution works on any environment.
 *
 * If NODE_DNS_OVERRIDE=false is set in the environment, the override is
 * skipped so that platform-managed DNS is used exclusively.
 */
if (process.env.NODE_DNS_OVERRIDE !== 'false') {
  try {
    dns.setServers(['8.8.8.8', '208.67.222.222', '1.1.1.1']);
  } catch {
    // setServers can throw if called at an unsafe time — safe to ignore
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

const connectDB = async (attempt = 1): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Atlas connected successfully');
    console.log(`   Database: ${mongoose.connection.db?.databaseName}`);
  } catch (error) {
    const err = error as Error;
    console.error(`❌ MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}`);

    if (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      console.error('  ▸ DNS/SRV lookup failure. Check Atlas Network Access or DNS settings.');
    } else if (err.message.toLowerCase().includes('auth') || err.message.toLowerCase().includes('bad auth')) {
      console.error('  ▸ Authentication failure. Verify MONGODB_URI credentials in environment.');
    } else if (err.message.includes('timeout')) {
      console.error('  ▸ Connection timeout. Check Atlas IP whitelist (Network Access → 0.0.0.0/0).');
    }

    if (attempt < MAX_RETRIES) {
      console.log(`  Retrying in ${RETRY_DELAY / 1000}s…`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return connectDB(attempt + 1);
    }

    if (process.env.NODE_ENV === 'production') {
      // Hard fail in production — no DB = no app
      process.exit(1);
    } else {
      console.warn('⚠️  Server starting without database connection (development mode).');
      console.warn('    DB-dependent endpoints will be unavailable until connection is restored.');
    }
  }
};

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));
mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));

export default connectDB;
