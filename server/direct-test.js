const { Pool } = require('pg');

console.log('🔍 Direct Connection Test');
console.log('=========================\n');

// Test 1: Working connection (like setup-vbpm.js)
console.log('Test 1: Working connection...');
const workingPool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'v_bpm',
  password: 'vitalis',
  port: 5432,
});

workingPool.connect()
  .then(client => {
    console.log('✅ Working connection successful!');
    client.release();
    return workingPool.end();
  })
  .then(() => {
    console.log('✅ Working pool closed');
    
    // Test 2: Using environment variables
    console.log('\nTest 2: Using environment variables...');
    require('dotenv').config();
    
    console.log('Environment variables:');
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
    console.log('DB_PORT:', process.env.DB_PORT);
    
    const envPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });
    
    return envPool.connect();
  })
  .then(client => {
    console.log('✅ Environment connection successful!');
    client.release();
    return envPool.end();
  })
  .then(() => {
    console.log('✅ Environment pool closed');
    console.log('\n🎉 Both connections work!');
  })
  .catch(error => {
    console.log('❌ Connection failed:', error.message);
    console.log('Code:', error.code);
    console.log('Severity:', error.severity);
    console.log('Detail:', error.detail);
  });
