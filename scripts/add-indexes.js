// Run: node --env-file=.env.local scripts/add-indexes.js
// Adds performance indexes to the database

const mysql = require('mysql2/promise');

async function addIndexes() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ai_vero',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const indexes = [
    { table: 'response_cache', name: 'idx_cache_agent_created', columns: 'agent_id, created_at' },
    { table: 'messages', name: 'idx_messages_conv_created', columns: 'conversation_id, created_at' },
    { table: 'conversations', name: 'idx_conv_agent', columns: 'agent_id' },
    { table: 'token_logs', name: 'idx_tokenlog_admin_created', columns: 'admin_id, created_at' },
    { table: 'unanswered_queries', name: 'idx_unanswered_admin', columns: 'admin_id, status' },
    { table: 'complaints', name: 'idx_complaints_admin_created', columns: 'admin_id, created_at' },
  ];

  for (const idx of indexes) {
    try {
      await pool.query(`CREATE INDEX ${idx.name} ON ${idx.table} (${idx.columns})`);
      console.log(`✅ Created index: ${idx.name} on ${idx.table}(${idx.columns})`);
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log(`⏭️  Index already exists: ${idx.name}`);
      } else {
        console.error(`❌ Failed: ${idx.name} — ${e.message}`);
      }
    }
  }

  await pool.end();
  console.log('\nDone!');
}

addIndexes();
