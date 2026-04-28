import { execute } from '../lib/db';

async function migrate() {
  try {
    await execute('ALTER TABLE general_info MODIFY website TEXT');
    console.log('Successfully altered general_info.website to TEXT');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
