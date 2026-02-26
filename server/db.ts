import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not found. Falling back to MemStorage.");
}

export const pool = process.env.DATABASE_URL 
  ? new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("supabase") ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    }) 
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
  });
}

export const db = pool ? drizzle(pool, { schema }) : null;
