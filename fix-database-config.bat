@echo off
echo Fixing Database Configuration
echo ============================
echo.

echo The connection test worked, but the database test failed.
echo This means the .env file might not be configured correctly.
echo.

echo Current working configuration (from test-connection.js):
echo - User: postgres
echo - Host: localhost  
echo - Database: postgres (for initial connection)
echo - Password: vitalis
echo - Port: 5432
echo.

echo Required configuration for .env:
echo - DB_USER=postgres
echo - DB_HOST=localhost
echo - DB_NAME=v_bpm
echo - DB_PASSWORD=vitalis
echo - DB_PORT=5432
echo.

echo Creating correct .env file...
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
) > server\.env

echo ✅ .env file created with correct configuration
echo.

echo Now testing the database connection...
cd server
node test-database.js

if errorlevel 1 (
  echo.
  echo ❌ Still failing. Let's try a different approach...
  echo Testing with postgres database first...
  (
  echo # Database Configuration
  echo DB_HOST=localhost
  echo DB_PORT=5432
  echo DB_NAME=postgres
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
  
  echo Testing with postgres database...
  node test-database.js
) else (
  echo.
  echo 🎉 Success! Database integration is working!
  echo You can now start the server with: npm run dev
)

pause
