# CogniHire Database Setup Script
Write-Host "🚀 CogniHire Database Setup Script" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green

Write-Host "`nStep 1: Installing dependencies..." -ForegroundColor Yellow
npm install oracledb bcryptjs jsonwebtoken @types/bcryptjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green

Write-Host "`nStep 2: Running database migration..." -ForegroundColor Yellow
npm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ Migration completed successfully!" -ForegroundColor Green

Write-Host "`nStep 3: Seeding database..." -ForegroundColor Yellow
npm run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Seeding failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ Database seeded successfully!" -ForegroundColor Green

Write-Host "`nStep 4: Testing database connection..." -ForegroundColor Yellow
npm run db:test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Database test failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ Database test passed!" -ForegroundColor Green

Write-Host "`n🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host "`n📋 Test Credentials:" -ForegroundColor Cyan
Write-Host "   Admin: admin@test.com / admin123" -ForegroundColor White
Write-Host "   Candidate: candidate@test.com / candidate123" -ForegroundColor White

Write-Host "`n🚀 Starting development server..." -ForegroundColor Yellow
npm run dev
