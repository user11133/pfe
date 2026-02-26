@echo off
echo PostgreSQL Connection Troubleshooting
echo ===================================
echo.

echo Checking PostgreSQL service status...
sc query postgresql-x64-16 2>nul || sc query postgresql-x64-15 2>nul || sc query postgresql-x64-14 2>nul || echo PostgreSQL service not found

echo.
echo Testing basic PostgreSQL connection...
echo.

echo Try these steps:
echo.
echo 1. Check if PostgreSQL is running:
echo    - Open Services (services.msc)
echo    - Look for "postgresql-x64-XX" service
echo    - Make sure it's "Running"
echo.
echo 2. Test connection with psql:
echo    psql -U postgres -h localhost -d postgres
echo    (Enter password: vitalis)
echo.
echo 3. Check if database exists:
echo    psql -U postgres -h localhost -c "\l"
echo    Look for "v_bpm" database
echo.
echo 4. Create database if missing:
echo    psql -U postgres -h localhost -c "CREATE DATABASE v_bpm;"
echo.
echo 5. Check PostgreSQL configuration:
echo    - Look for pg_hba.conf in PostgreSQL data directory
echo    - Make sure it allows local connections
echo.
echo 6. Try different connection methods:
echo    - Change DB_HOST from localhost to 127.0.0.1
echo    - Or try without host (use Unix socket)
echo.

echo After fixing, run: test-database.bat
echo.
pause
