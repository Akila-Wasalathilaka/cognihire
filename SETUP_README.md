# CogniHire Database Setup Guide

## 🚀 Quick Setup (Recommended)

### Option 1: PowerShell Script (Recommended)
```powershell
.\setup.ps1
```

### Option 2: Batch Script
```cmd
setup.bat
```

### Option 3: Manual Setup
```powershell
# 1. Install dependencies
npm install oracledb bcryptjs jsonwebtoken @types/bcryptjs

# 2. Run migration
npm run db:migrate

# 3. Seed database
npm run db:seed

# 4. Test connection
npm run db:test

# 5. Start development server
npm run dev
```

## 📋 Prerequisites

1. **Oracle Database Server**: Running on `140.245.237.56:1521/XEPDB1`
2. **Oracle User**: `cognihire` with password `password123`
3. **SSH Access**: SSH key configured for server access
4. **Oracle Instant Client**: Installed locally (optional for development)

## 🔧 Configuration

### Environment Variables (.env.local)
```bash
# Database
ORACLE_USER=cognihire
ORACLE_PASSWORD=password123
ORACLE_CONNECT_STRING=140.245.237.56:1521/XEPDB1

# JWT
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random-123456789
JWT_REFRESH_SECRET=your-refresh-secret-key-here-make-it-different-987654321

# App
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here-random-string
```

## 📊 Database Schema

The setup creates the following tables:
- `TENANTS` - Multi-tenant support
- `USERS` - User accounts (Admin/Candidate)
- `GAMES` - Cognitive assessment games
- `JOB_ROLES` - Job role definitions
- `ASSESSMENTS` - Assessment sessions
- `ASSESSMENT_ITEMS` - Individual game results
- `REPORTS` - Assessment reports
- `AUDIT_LOGS` - System audit trail

## 👥 Test Accounts

After setup, you can login with:

### Admin Account
- **Email**: `admin@test.com`
- **Password**: `admin123`
- **URL**: `http://localhost:3000/admin/login`

### Candidate Account
- **Email**: `candidate@test.com`
- **Password**: `candidate123`
- **URL**: `http://localhost:3000/login`

## 🧪 Available Scripts

```bash
# Run migration only
npm run db:migrate

# Seed database only
npm run db:seed

# Test database connection
npm run db:test

# Start development server
npm run dev
```

## 🚨 Troubleshooting

### Database Connection Issues
1. Check Oracle server is running: `ssh ubuntu@140.245.237.56 "sudo systemctl status oracle"`
2. Verify connection string in `.env.local`
3. Ensure Oracle user has proper permissions

### SSH Connection Issues
1. Check SSH key permissions: `icacls ssh-key-2025-08-22.key`
2. Fix permissions: `icacls ssh-key-2025-08-22.key /inheritance:r /grant:r "%USERNAME%:F"`

### Port Issues
1. Ensure port 1521 is open on Oracle server
2. Check firewall settings

## 🎯 Next Steps

1. **Run the setup script**: `.\setup.ps1`
2. **Test login**: Visit `http://localhost:3000/login`
3. **Access admin panel**: Visit `http://localhost:3000/admin/login`
4. **Start building**: Your CogniHire platform is ready!

## 📞 Support

If you encounter any issues:
1. Check the error messages in the console
2. Verify your Oracle database is accessible
3. Ensure all environment variables are set correctly
4. Check SSH connection to your server

Happy coding! 🚀
