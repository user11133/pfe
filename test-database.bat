@echo off
echo Testing v-bpm PostgreSQL Database Integration
echo ============================================
echo.

echo Step 1: Checking if dependencies are installed...
cd server
if not exist node_modules (
  echo Installing dependencies...
  npm install pg bcryptjs jsonwebtoken
  if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
  )
)
echo ✅ Dependencies installed

echo.
echo Step 2: Creating .env file from example...
if not exist .env (
  copy .env.example .env
  echo ✅ .env file created from example
) else (
  echo ✅ .env file already exists
)

echo.
echo Step 3: Testing database connection...
node test-database.js

if errorlevel 1 (
  echo.
  echo ❌ Database test failed!
  echo.
  echo Troubleshooting:
  echo 1. Make sure PostgreSQL is running
  echo 2. Check database name: v_bpm
  echo 3. Check user: postgres
  echo 4. Check password in .env file
  echo 5. Make sure database was created
  pause
) else (
  echo.
  echo 🎉 Database integration test successful!
  echo You can now start the server with: npm run dev
  pause
)
