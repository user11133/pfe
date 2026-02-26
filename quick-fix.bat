@echo off
echo Quick Database Fix
echo =================
echo.

cd server

echo Step 1: Setting up v_bpm database...
node setup-vbpm.js

echo.
echo Step 2: Updating .env file...
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

echo ✅ .env file updated
echo.

echo Step 3: Testing database integration...
node test-database.js

if errorlevel 1 (
  echo.
  echo ❌ Database test failed
  echo.
  echo Let's try the working connection directly...
  node -e "
const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'v_bpm',
  password: 'vitalis',
  port: 5432,
});

pool.connect().then(client => {
  console.log('✅ Direct connection to v_bpm works!');
  client.release();
  return pool.end();
}).catch(err => {
  console.log('❌ Direct connection failed:', err.message);
});
"
) else (
  echo.
  echo 🎉 SUCCESS! PostgreSQL integration is working!
  echo.
  echo You can now start the server with: npm run dev
)

pause
