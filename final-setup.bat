@echo off
echo Final Database Setup
echo ===================
echo.

echo Environment variables are working!
echo Now setting up the v_bpm database correctly...
echo.

cd server

echo Creating v_bpm database if it doesn't exist...
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'vitalis',
  port: 5432,
});

async function setupDatabase() {
  try {
    const client = await pool.connect();
    
    // Create v_bpm database
    await client.query('CREATE DATABASE IF NOT EXISTS v_bpm');
    console.log('✅ Database v_bpm created/verified');
    
    client.release();
    await pool.end();
    
    // Now test with v_bpm database
    const vBpmPool = new Pool({
      user: 'postgres',
      host: 'localhost',
      database: 'v_bpm',
      password: 'vitalis',
      port: 5432,
    });
    
    const vBpmClient = await vBpmPool.connect();
    console.log('✅ Connected to v_bpm database');
    vBpmClient.release();
    await vBpmPool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

setupDatabase();
"

echo.
echo Updating .env to use v_bpm database...
(
echo # Database Configuration
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=v_bpm
echo DB_USER=postgres
echo DB_PASSWORD=vitalis
echo.
echo # JWT Configuration
echo JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-12345
echo.
echo # Camunda Configuration
echo CAMUNDA_REST_API=http://localhost:8080/engine-rest
echo.
echo # Server Configuration
echo PORT=5001
echo.
echo # Environment
echo NODE_ENV=development
) > .env

echo ✅ .env updated to use v_bpm database
echo.

echo Testing complete database integration...
node test-database.js

if errorlevel 1 (
  echo.
  echo ❌ Database test still failing
) else (
  echo.
  echo 🎉 SUCCESS! PostgreSQL integration is working!
  echo.
  echo You can now:
  echo 1. Start the server: npm run dev
  echo 2. Test authentication in the browser
  echo 3. Register and login users
)

pause
