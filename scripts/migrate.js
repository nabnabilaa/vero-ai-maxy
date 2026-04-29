// ============================================================
// Vero AI — Database Migration Runner
// Usage: node --env-file=.env.local scripts/migrate.js
// ============================================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ai_vero',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true, // Allow running multiple SQL statements in one query
  });

  try {
    // 1. Create schema_migrations table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME DEFAULT NOW()
      )
    `);
    console.log('📋 schema_migrations table ready\n');

    // 2. Get already-applied migrations
    const [applied] = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
    const appliedSet = new Set(applied.map(r => r.version));

    // 3. Read migration files
    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  No migrations directory found at:', migrationsDir);
      await pool.end();
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Lexicographic sort ensures 001 < 002 < ...

    if (files.length === 0) {
      console.log('⚠️  No migration files found.');
      await pool.end();
      return;
    }

    // 4. Run pending migrations
    let newCount = 0;
    for (const file of files) {
      const version = file.replace('.sql', '');
      if (appliedSet.has(version)) {
        console.log(`⏭️  Already applied: ${file}`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8').trim();

      if (!sql) {
        console.log(`⏭️  Empty file, skipping: ${file}`);
        continue;
      }

      console.log(`🚀 Running: ${file}...`);
      const conn = await pool.getConnection();
      try {
        // Split by semicolon for individual statement execution
        // This handles cases where multipleStatements might not work perfectly
        const statements = sql
          .split(/;\s*$/m)
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
          try {
            await conn.query(stmt);
          } catch (e) {
            // Skip "already exists" errors for CREATE TABLE IF NOT EXISTS and CREATE INDEX
            if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_KEYNAME') {
              console.log(`   ⏭️  Already exists, skipping statement`);
            } else {
              throw e;
            }
          }
        }

        // Record migration as applied
        await conn.query('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
        console.log(`   ✅ Applied: ${file}`);
        newCount++;
      } catch (e) {
        console.error(`   ❌ Failed: ${file}`, e.message);
        throw e; // Stop on failure
      } finally {
        conn.release();
      }
    }

    console.log(`\n✨ Migration complete! ${newCount} new migration(s) applied, ${appliedSet.size} already up-to-date.`);
  } catch (e) {
    console.error('\n❌ Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
