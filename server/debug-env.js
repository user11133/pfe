const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

console.log('🔍 Debugging Environment Configuration');
console.log('=====================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('\n📄 .env file content:');
  console.log(envContent);
} else {
  console.log('❌ .env file does not exist');
}

console.log('\n🔧 Environment variables loaded:');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('DB_PORT:', process.env.DB_PORT);

console.log('\n🧪 Testing connection with environment variables...');

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'v_bpm',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function testEnvConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Connection successful with environment variables!');
    
    const result = await client.query('SELECT current_database(), current_user');
    console.log('📊 Database info:', result.rows[0]);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.log('❌ Connection failed with environment variables:', error.message);
    
    console.log('\n🔄 Trying with hardcoded working values...');
    const workingPool = new Pool({
      user: 'postgres',
      host: 'localhost',
      database: 'postgres',
      password: 'vitalis',
      port: 5432,
    });
    
    try {
      const client = await workingPool.connect();
      console.log('✅ Hardcoded connection works!');
      
      // Create v_bpm database if it doesn't exist
      await client.query('CREATE DATABASE IF NOT EXISTS v_bpm');
      console.log('✅ Database v_bpm ensured');
      
      client.release();
      await workingPool.end();
    } catch (error2) {
      console.log('❌ Even hardcoded connection failed:', error2.message);
    }
  }
}

testEnvConnection();
