const { pool, initDatabase } = require('./services/database');

async function testDatabaseConnection() {
  console.log('🔍 Testing PostgreSQL Database Connection...\n');
  
  try {
    // Test basic connection
    console.log('1. Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL successfully');
    
    // Test database initialization
    console.log('\n2. Testing database initialization...');
    await initDatabase();
    console.log('✅ Database tables created/verified');
    
    // Test user table
    console.log('\n3. Testing user table...');
    const userTableResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('✅ Users table structure:');
    userTableResult.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
    });
    
    // Test session table
    console.log('\n4. Testing session table...');
    const sessionTableResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions'
      ORDER BY ordinal_position
    `);
    console.log('✅ Sessions table structure:');
    sessionTableResult.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
    });
    
    // Test inserting a sample user
    console.log('\n5. Testing user insertion...');
    const testUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword123'
    };
    
    const authService = require('./services/authService');
    const user = await authService.register(testUser.name, testUser.email, testUser.password);
    console.log('✅ Test user created:', { id: user.id, name: user.name, email: user.email });
    
    // Test user login
    console.log('\n6. Testing user login...');
    const loginResult = await authService.login(testUser.email, testUser.password);
    console.log('✅ Login successful:', { id: loginResult.id, hasToken: !!loginResult.token });
    
    // Test token validation
    console.log('\n7. Testing token validation...');
    await authService.validateToken(loginResult.token);
    console.log('✅ Token validation successful');
    
    // Clean up test data
    console.log('\n8. Cleaning up test data...');
    await client.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    console.log('✅ Test data cleaned up');
    
    client.release();
    
    console.log('\n🎉 All database tests passed! PostgreSQL integration is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Database test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Load environment variables first
require('dotenv').config();

// Run test
testDatabaseConnection();
