@echo off
echo Setting up v-bpm PostgreSQL database...
echo.

echo 1. Make sure PostgreSQL is installed and running
echo 2. Open pgAdmin at http://localhost:5050
echo 3. Login with postgres user
echo 4. Create database named 'v_bpm'
echo.

echo Creating .env file with database configuration...
echo Please update DB_PASSWORD with your actual PostgreSQL password
echo.

(
echo # Database Configuration
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=v_bpm
echo DB_USER=postgres
echo DB_PASSWORD=your_postgres_password_here
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

echo.
echo .env file created successfully!
echo Please edit server\.env and update DB_PASSWORD with your actual PostgreSQL password
echo.
pause
