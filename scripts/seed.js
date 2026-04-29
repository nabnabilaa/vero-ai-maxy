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
    const usersToSeed = [
      {
        email: 'it.maxy.academy@gmail.com',
        password: 'timdeveloper1313',
        name: 'Maxy Academy Admin',
        industry: 'Education',
        organization: 'Maxy Academy'
      },
      {
        email: 'it@gmail.com',
        password: '123123',
        name: 'IT Admin Demo',
        industry: 'Technology',
        organization: 'IT Dept'
      }
    ];

    for (const user of usersToSeed) {
      // Check if user already exists
      const [existing] = await pool.query('SELECT * FROM admins WHERE email = ?', [user.email]);
      if (existing.length > 0) {
        console.log(`User ${user.email} already exists, skipping.`);
        continue;
      }

      const passwordHash = await bcrypt.hash(user.password, 10);
      const id = uuidv4();

      await pool.query(
        'INSERT INTO admins (id, email, password_hash, name, industry, organization) VALUES (?, ?, ?, ?, ?, ?)',
        [id, user.email, passwordHash, user.name, user.industry, user.organization]
      );

      console.log(`Successfully seeded ${user.email}!`);
    }
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
