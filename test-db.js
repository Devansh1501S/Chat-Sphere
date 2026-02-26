import pg from 'pg';
import "dotenv/config";
import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const { Pool } = pg;

async function testConnection() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set in .env');
    return;
  }

  const host = new URL(url).hostname;
  console.log(`\n🔍 Analyzing host: ${host}`);

  try {
    const ipv4 = await resolve4(host);
    console.log('✅ IPv4 addresses found:', ipv4);
  } catch (err) {
    console.warn('⚠️ No IPv4 addresses found. This environment might struggle to connect if it doesn\'t support IPv6.');
  }

  try {
    const ipv6 = await resolve6(host);
    console.log('✅ IPv6 addresses found:', ipv6);
  } catch (err) {
    console.log('ℹ️ No IPv6 addresses found.');
  }

  console.log('\n🚀 Testing connection...');
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    const client = await pool.connect();
    console.log('🎉 SUCCESS: Connected to the database!');
    const res = await client.query('SELECT NOW()');
    console.log('⏰ Database time:', res.rows[0].now);
    await client.release();
    await pool.end();
  } catch (err) {
    console.error('❌ CONNECTION FAILED:', err.message);
    
    if (err.message.includes('ENOTFOUND') || err.message.includes('ENETUNREACH')) {
      console.log('\n💡 SUGGESTION:');
      console.log('It looks like a network or DNS issue. If you are using Supabase:');
      console.log('1. Go to Supabase Dashboard -> Project Settings -> Database');
      console.log('2. Look for "Connection Pooler" section');
      console.log('3. Use the "Transaction" mode connection string (usually port 6543)');
      console.log('4. This URL usually has an IPv4 address which is more compatible.');
    }
  }
}

testConnection();
