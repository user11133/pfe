@echo off
echo PostgreSQL Password Fix
echo =======================
echo.

echo The test failed because PostgreSQL authentication failed.
echo You need to match the password in your .env file with your actual PostgreSQL password.
echo.

echo Current .env password is set to: vitalis
echo.

echo Options:
echo 1. Change PostgreSQL password to 'vitalis'
echo 2. Update .env file with your actual PostgreSQL password
echo 3. Create a new PostgreSQL user
echo.

echo Option 1: Reset PostgreSQL password
echo ----------------------------------
echo Open SQL shell (psql) and run:
echo ALTER USER postgres PASSWORD 'vitalis';
echo.

echo Option 2: Find your actual password
echo ------------------------------------
echo 1. Open pgAdmin
echo 2. Check connection settings for postgres user
echo 3. Copy the actual password
echo 4. Update server\.env file with that password
echo.

echo Option 3: Create new user
echo -------------------------
echo Run these SQL commands:
echo CREATE USER v_bpm_user WITH PASSWORD 'vitalis';
echo CREATE DATABASE v_bpm OWNER v_bpm_user;
echo GRANT ALL PRIVILEGES ON DATABASE v_bpm TO v_bpm_user;
echo.
echo Then update .env file:
echo DB_USER=v_bpm_user
echo DB_PASSWORD=vitalis
echo.

echo After fixing the password, run: test-database.bat
echo.
pause
