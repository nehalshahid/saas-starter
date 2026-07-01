import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Supabase (and most managed Postgres providers) require SSL on the connection.
// Local Postgres doesn't, so this is conditional based on the connection string —
// Supabase URLs always contain "supabase.com".
const isManagedDb = (process.env.DATABASE_URL || '').includes('supabase.com');

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isManagedDb ? { rejectUnauthorized: false } : false,
});

export const query = (text, params) => pool.query(text, params);

// Helper for transactions
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
