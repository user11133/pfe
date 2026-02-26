const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function cleanupTestUser() {
  try {
    const client = await pool.connect();
    
    // Clean up test user and sessions
    await client.query('DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)', ['test@example.com']);
    await client.query('DELETE FROM users WHERE email = $1', ['test@example.com']);
    
    console.log('✅ Test data cleaned up');
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

cleanupTestUser();
