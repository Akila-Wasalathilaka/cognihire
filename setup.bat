@echo off
echo 🚀 CogniHire Database Setup Script
echo ==================================

echo Step 1: Installing dependencies...
npm install oracledb bcryptjs jsonwebtoken @types/bcryptjs
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed successfully!

echo.
echo Step 2: Running database migration...
npm run db:migrate
if %errorlevel% neq 0 (
    echo ❌ Migration failed
    pause
    exit /b 1
)
echo ✅ Migration completed successfully!

echo.
echo Step 3: Seeding database...
npm run db:seed
if %errorlevel% neq 0 (
    echo ❌ Seeding failed
    pause
    exit /b 1
)
echo ✅ Database seeded successfully!

echo.
echo Step 4: Testing database connection...
npm run db:test
if %errorlevel% neq 0 (
    echo ❌ Database test failed
    pause
    exit /b 1
)
echo ✅ Database test passed!

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Test Credentials:
echo    Admin: admin@test.com / admin123
echo    Candidate: candidate@test.com / candidate123
echo.
echo 🚀 Starting development server...
npm run dev

pause
