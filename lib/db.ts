import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

// Reuse pool across Next.js hot reloads to prevent "Too many connections"
const globalForDb = globalThis as unknown as { mysqlPool: mysql.Pool };

const poolConfig: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'ai_vero',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  idleTimeout: 30000,
};

// Enable SSL if specified in environment variable
if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false }; // Aiven uses SSL, we set false to avoid CA cert issues if not provided
}

const pool = globalForDb.mysqlPool || mysql.createPool(poolConfig);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.mysqlPool = pool;
}

// ---- helpers ----
/** Run a query that returns rows (SELECT) */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

/** Run a query that returns a single row */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Run a mutation (INSERT / UPDATE / DELETE) */
export async function execute(sql: string, params: any[] = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

// Schema is now managed by `node --env-file=.env.local scripts/migrate.js`
// Run migrations before first deployment or after schema changes.

export { uuidv4 };
export default pool;
