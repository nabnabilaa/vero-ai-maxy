const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ai_vero',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const email = 'it.maxy.academy@gmail.com';
    const password = 'timdeveloper1313';

    // Check if user already exists
    const [existing] = await pool.query('SELECT * FROM admins WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.log('User already exists, skipping seeding.');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await pool.query(
      'INSERT INTO admins (id, email, password_hash, name, industry, organization) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, passwordHash, 'Maxy Academy Admin', 'Education', 'Maxy Academy']
    );

    console.log('Successfully seeded Maxy Academy admin user!');
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
