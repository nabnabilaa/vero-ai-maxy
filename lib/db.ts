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

// ---- Initialization (tables + seed) ----
async function initializeDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(255) NOT NULL DEFAULT 'General',
        organization VARCHAR(255) DEFAULT '',
        created_at DATETIME DEFAULT NOW(),
        updated_at DATETIME DEFAULT NOW()
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS general_info (
        id VARCHAR(255) PRIMARY KEY,
        admin_id VARCHAR(255) UNIQUE NOT NULL,
        business_name VARCHAR(255) DEFAULT '',
        address TEXT DEFAULT (''),
        city VARCHAR(255) DEFAULT '',
        phone VARCHAR(255) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        website TEXT,
        maps_link TEXT DEFAULT (''),
        description TEXT,
        extra_data TEXT,
        updated_at DATETIME DEFAULT NOW(),
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(255) PRIMARY KEY,
        admin_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255) DEFAULT 'Assistant',
        tone VARCHAR(255) DEFAULT 'Professional',
        language VARCHAR(255) DEFAULT 'Indonesian',
        voice_type VARCHAR(50) DEFAULT 'female',
        quick_actions TEXT,
        instructions TEXT,
        goal TEXT,
        industry VARCHAR(255) DEFAULT 'General',
        topic VARCHAR(255) DEFAULT '',
        is_active TINYINT DEFAULT 1,
        token_usage INT DEFAULT 0,
        created_at DATETIME DEFAULT NOW(),
        updated_at DATETIME DEFAULT NOW(),
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS knowledge_sources (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        content LONGTEXT,
        mime_type VARCHAR(255) DEFAULT 'text/plain',
        date_added DATETIME DEFAULT NOW(),
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS general_knowledge_sources (
        id VARCHAR(255) PRIMARY KEY,
        admin_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        content LONGTEXT,
        mime_type VARCHAR(255) DEFAULT 'text/plain',
        date_added DATETIME DEFAULT NOW(),
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        session_type VARCHAR(50) DEFAULT 'chat',
        user_name VARCHAR(255) DEFAULT 'Anonymous',
        user_phone VARCHAR(255) DEFAULT '',
        sentiment VARCHAR(255) DEFAULT '',
        status VARCHAR(50) DEFAULT 'active',
        is_complaint TINYINT DEFAULT 0,
        complaint_summary TEXT,
        started_at DATETIME DEFAULT NOW(),
        ended_at DATETIME NULL,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        conversation_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content LONGTEXT NOT NULL,
        tokens_used INT DEFAULT 0,
        created_at DATETIME DEFAULT NOW(),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id VARCHAR(255) PRIMARY KEY,
        conversation_id VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255) NOT NULL,
        admin_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) DEFAULT '',
        user_phone VARCHAR(255) DEFAULT '',
        summary TEXT,
        details TEXT,
        status VARCHAR(50) DEFAULT 'open',
        priority VARCHAR(50) DEFAULT 'medium',
        created_at DATETIME DEFAULT NOW(),
        resolved_at DATETIME NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (admin_id) REFERENCES admins(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS response_cache (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        question_hash VARCHAR(255) NOT NULL,
        question TEXT,
        response LONGTEXT,
        hit_count INT DEFAULT 0,
        created_at DATETIME DEFAULT NOW(),
        UNIQUE KEY unique_agent_hash (agent_id, question_hash),
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS unanswered_queries (
        id VARCHAR(255) PRIMARY KEY,
        admin_id VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255) NOT NULL,
        question TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        created_at DATETIME DEFAULT NOW(),
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS token_logs (
        id VARCHAR(255) PRIMARY KEY,
        admin_id VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255),
        source VARCHAR(50) DEFAULT 'chat',
        action VARCHAR(100) DEFAULT '',
        tokens_used INT DEFAULT 0,
        from_cache TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT NOW(),
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS conversation_ratings (
        id VARCHAR(255) PRIMARY KEY,
        conversation_id VARCHAR(255),
        agent_id VARCHAR(255) NOT NULL,
        rating INT NOT NULL,
        feedback TEXT,
        created_at DATETIME DEFAULT NOW(),
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Seed default admin accounts
    const bcrypt = await import('bcryptjs');
    const admins = [
      { email: 'hotel@vero.ai', password: 'admin123', name: 'Hotel Admin', industry: 'Hotel', org: 'Grand Vero Hotel' },
      { email: 'retail@vero.ai', password: 'admin123', name: 'Retail Admin', industry: 'Retail', org: 'Vero Retail' },
      { email: 'restaurant@vero.ai', password: 'admin123', name: 'Restaurant Admin', industry: 'Restaurant', org: 'Vero Restaurant' },
      { email: 'realestate@vero.ai', password: 'admin123', name: 'Real Estate Admin', industry: 'Real Estate', org: 'Vero Properties' },
      { email: 'admin@vero.ai', password: 'admin123', name: 'Admin', industry: 'General', org: 'Maxy Academy' },
    ];

    for (const admin of admins) {
      const hash = bcrypt.hashSync(admin.password, 10);
      await conn.query(
        `INSERT IGNORE INTO admins (id, email, password_hash, name, industry, organization) VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), admin.email, hash, admin.name, admin.industry, admin.org]
      );
    }

    console.log('[DB] MySQL initialized successfully');
  } catch (e: any) {
    console.error('[DB] Init error:', e.message);
  } finally {
    conn.release();
  }
}

// Run init on import
initializeDatabase();

export { uuidv4 };
export default pool;
