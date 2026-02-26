const { Pool } = require('pg');

async function setupVbpmDatabase() {
  console.log('🔧 Setting up v_bpm database...');
  
  try {
    // Connect to postgres database first
    const postgresPool = new Pool({
      user: 'postgres',
      host: 'localhost',
      database: 'postgres',
      password: 'vitalis',
      port: 5432,
    });

    const postgresClient = await postgresPool.connect();
    
    // Check if v_bpm database exists
    const checkDb = await postgresClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      ['v_bpm']
    );
    
    if (checkDb.rows.length === 0) {
      // Create v_bpm database
      await postgresClient.query('CREATE DATABASE v_bpm');
      console.log('✅ Database v_bpm created');
    } else {
      console.log('✅ Database v_bpm already exists');
    }
    
    postgresClient.release();
    await postgresPool.end();

    // Test connection to v_bpm database
    const vbpmPool = new Pool({
      user: 'postgres',
      host: 'localhost',
      database: 'v_bpm',
      password: 'vitalis',
      port: 5432,
    });

    const vbpmClient = await vbpmPool.connect();
    console.log('✅ Connected to v_bpm database');
    
    // Test basic query
    const result = await vbpmClient.query('SELECT current_database()');
    console.log('📊 Current database:', result.rows[0].current_database);
    
    vbpmClient.release();
    await vbpmPool.end();
    
    console.log('🎉 Database setup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

setupVbpmDatabase();
