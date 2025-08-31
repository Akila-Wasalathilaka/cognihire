# 🚀 CogniHire Production Deployment Guide

This guide provides comprehensive deployment instructions for the CogniHire cognitive assessment platform on Oracle Free Tier Ubuntu VM and other cloud providers.

## 📋 Quick Start Options

### Option 1: Oracle Free Tier Ubuntu VM (Recommended for Free Tier)

#### Automated Deployment
```bash
# 1. Upload project files to /home/ubuntu/cognihire
scp -r /path/to/cognihire ubuntu@your-vm-ip:/home/ubuntu/

# 2. Make script executable and run
chmod +x /home/ubuntu/cognihire/deploy.sh
cd /home/ubuntu/cognihire
./deploy.sh
```

**What this does:**
- ✅ Installs Node.js 20, Python 3, Nginx
- ✅ Sets up FastAPI backend with SQLite database
- ✅ Builds Next.js frontend for production
- ✅ Creates systemd services for auto-start
- ✅ Configures Nginx reverse proxy
- ✅ Initializes database with sample data
- ✅ Sets up firewall and security

#### Access Your Application
- **Frontend**: `http://your-vm-public-ip`
- **Backend API**: `http://your-vm-public-ip/api/`
- **API Docs**: `http://your-vm-public-ip/api/docs`
- **Default Admin**: `admin` / `admin123` (change immediately!)

### Option 2: Oracle Autonomous Database + Docker

For full Oracle database integration with Docker containers.

## 🛠️ Prerequisites

### Oracle Free Tier Ubuntu VM
- Ubuntu 20.04 or later
- At least 1GB RAM (Free Tier limit)
- SSH access configured
- Project files uploaded

### Oracle Autonomous Database (Optional)
- Oracle Autonomous Database instance
- Database user and password
- Network access rules configured

## 📁 Project Structure for Deployment

Ensure your project has these files:
```
cognihire/
├── deploy.sh                 # Main deployment script
├── cognihire-backend.service # Systemd service for backend
├── cognihire-frontend.service # Systemd service for frontend
├── nginx-cognihire.conf     # Nginx configuration
├── backend/
│   ├── requirements.txt      # Python dependencies
│   ├── init_db.py           # Database initialization
│   └── .env.example         # Backend environment template
├── .env.local.example       # Frontend environment template
└── DEPLOYMENT_README.md     # This file
```

## ⚙️ Configuration

### Environment Variables

#### Backend (.env)
```bash
DATABASE_URL=sqlite:///./prod.db
SECRET_KEY=your-super-secret-jwt-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
```

### Database Options

#### SQLite (Default - Free Tier Friendly)
- No additional setup required
- File-based database
- Perfect for Free Tier limitations
- Automatic initialization with sample data

#### Oracle Autonomous Database
```bash
DATABASE_URL=oracle+cx_oracle://username:password@host:port/service_name
```

## 🚀 Deployment Methods

### Method 1: Automated Script (Free Tier)

1. **Upload project** to `/home/ubuntu/cognihire`
2. **Run deployment**:
   ```bash
   cd /home/ubuntu/cognihire
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Monitor deployment**:
   ```bash
   sudo systemctl status cognihire-backend
   sudo systemctl status cognihire-frontend
   sudo systemctl status nginx
   ```

### Method 2: Docker Deployment

```bash
# Configure environment
cp .env.example .env
# Edit .env with your values

# Deploy with Docker
chmod +x deploy.sh
./deploy.sh --docker
```

### Method 3: Traditional Deployment

```bash
# Configure environment
cp .env.example .env
# Edit .env with your values

# Deploy traditionally
chmod +x deploy.sh
./deploy.sh --traditional
```

## 🔧 Manual Setup (If Script Fails)

### System Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# Install Python
sudo apt install -y python3 python3-venv python3-pip

# Install Nginx
sudo apt install -y nginx
```

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env
python3 init_db.py
```

### Frontend Setup
```bash
npm install
cp .env.local.example .env.local
# Edit .env.local
npm run build
```

### Services & Nginx
```bash
# Copy service files
sudo cp cognihire-backend.service /etc/systemd/system/
sudo cp cognihire-frontend.service /etc/systemd/system/

# Copy Nginx config
sudo cp nginx-cognihire.conf /etc/nginx/sites-available/cognihire
sudo ln -s /etc/nginx/sites-available/cognihire /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable cognihire-backend cognihire-frontend nginx
sudo systemctl start cognihire-backend cognihire-frontend nginx
```

## 📊 Monitoring & Management

### Service Status
```bash
# Check all services
sudo systemctl status cognihire-backend cognihire-frontend nginx

# View logs
sudo journalctl -u cognihire-backend -f
sudo journalctl -u cognihire-frontend -f
sudo tail -f /var/log/nginx/access.log
```

### Health Checks
```bash
# Application health
curl http://localhost/health

# API health
curl http://localhost:8000/docs

# Frontend health
curl http://localhost:3000
```

### Process Management
```bash
# Restart services
sudo systemctl restart cognihire-backend
sudo systemctl restart cognihire-frontend
sudo systemctl restart nginx

# Stop services
sudo systemctl stop cognihire-backend cognihire-frontend nginx
```

## 🔒 Security & Production

### SSL Setup
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Update environment variables for HTTPS
NEXTAUTH_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```

### Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

### Database Security
- Change default admin password
- Use strong database passwords
- Regular backups (SQLite: copy the .db file)
- For Oracle: Configure proper access rules

## 🐛 Troubleshooting

### Common Issues

1. **Services won't start**:
   ```bash
   sudo journalctl -u cognihire-backend -n 50
   sudo journalctl -u cognihire-frontend -n 50
   ```

2. **Database errors**:
   - Check DATABASE_URL in .env
   - Verify file permissions for SQLite
   - Test database connection

3. **Nginx issues**:
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

4. **Port conflicts**:
   ```bash
   sudo netstat -tlnp | grep :3000
   sudo netstat -tlnp | grep :8000
   sudo netstat -tlnp | grep :80
   ```

### Performance Issues
- Monitor memory usage: `htop` or `free -h`
- Check disk space: `df -h`
- View application logs for errors
- Restart services if needed

## 📈 Scaling & Optimization

### Free Tier Optimizations
- SQLite database (low resource usage)
- Single instance deployment
- Gzip compression enabled
- Static file caching configured

### Performance Monitoring
```bash
# System resources
top
htop
free -h
df -h

# Application metrics
sudo journalctl -u cognihire-backend --since "1 hour ago" | grep -i error
```

### Backup Strategy
```bash
# SQLite backup
cp /home/ubuntu/cognihire/backend/prod.db /home/ubuntu/backups/prod_$(date +%Y%m%d).db

# Application backup
tar -czf /home/ubuntu/backups/app_$(date +%Y%m%d).tar.gz /home/ubuntu/cognihire
```

## 🎯 Default Credentials

**Important**: Change these immediately after first login!

- **Username**: `admin`
- **Password**: `admin123`

## 📞 Support & Resources

### Quick Commands
```bash
# Full system status
sudo systemctl status cognihire-* nginx

# View all logs
sudo journalctl -u cognihire-backend cognihire-frontend nginx --since today

# Restart everything
sudo systemctl restart cognihire-backend cognihire-frontend nginx
```

### Oracle Cloud Resources
- [Oracle Free Tier Documentation](https://docs.oracle.com/en/cloud/get-started/)
- [Ubuntu on Oracle Cloud](https://docs.oracle.com/en/cloud/iaas/compute-iaas-cloud/)
- [Oracle Autonomous Database](https://docs.oracle.com/en/cloud/paas/autonomous-database/)

---

## ✅ Deployment Checklist

- [ ] Oracle Free Tier Ubuntu VM created
- [ ] SSH access configured
- [ ] Project files uploaded
- [ ] deploy.sh executed successfully
- [ ] Services running (backend, frontend, nginx)
- [ ] Application accessible via public IP
- [ ] Default password changed
- [ ] SSL certificate configured (optional)
- [ ] Firewall properly configured
- [ ] Backups scheduled (recommended)

**🎉 Deployment Complete!** Your CogniHire application is now live on Oracle Free Tier!