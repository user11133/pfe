const { Pool } = require('pg');

// Test different connection configurations
const configs = [
  {
    name: 'Default (localhost)',
    config: {
      user: 'postgres',
      host: 'localhost',
      database: 'postgres', // Test with default database first
      password: 'vitalis',
      port: 5432,
    }
  },
  {
    name: '127.0.0.1',
    config: {
      user: 'postgres',
      host: '127.0.0.1',
      database: 'postgres',
      password: 'vitalis',
      port: 5432,
    }
  },
  {
    name: 'No host (Unix socket)',
    config: {
      user: 'postgres',
      database: 'postgres',
      password: 'vitalis',
      port: 5432,
    }
  }
];

async function testConnections() {
  console.log('🔍 Testing PostgreSQL Connection Configurations\n');
  
  for (const test of configs) {
    console.log(`Testing: ${test.name}`);
    console.log('----------------------------------------');
    
    try {
      const pool = new Pool(test.config);
      const client = await pool.connect();
      
      // Test basic query
      const result = await client.query('SELECT version()');
      console.log('✅ Connection successful!');
      console.log('PostgreSQL version:', result.rows[0].version.split(' ')[1]);
      
      // Test if v_bpm database exists
      const dbCheck = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', ['v_bpm']);
      if (dbCheck.rows.length > 0) {
        console.log('✅ Database "v_bpm" exists');
      } else {
        console.log('⚠️  Database "v_bpm" does not exist - creating it...');
        await client.query('CREATE DATABASE v_bpm');
        console.log('✅ Database "v_bpm" created');
      }
      
      client.release();
      await pool.end();
      
      console.log('🎉 This configuration works!\n');
      return test.config;
      
    } catch (error) {
      console.log('❌ Failed:', error.message);
      console.log('');
    }
  }
  
  console.log('❌ All configurations failed');
  console.log('\nTroubleshooting:');
  console.log('1. Make sure PostgreSQL service is running');
  console.log('2. Check if password is really "vitalis"');
  console.log('3. Verify PostgreSQL is accepting connections');
  console.log('4. Check firewall/antivirus settings');
}

testConnections();
