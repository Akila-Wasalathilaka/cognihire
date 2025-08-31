# CogniHire Production Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the CogniHire cognitive assessment platform to Oracle Cloud or any cloud provider.

## Prerequisites

### Oracle Cloud Setup
1. **Oracle Autonomous Database**:
   - Create an Oracle Autonomous Database instance
   - Note down the connection details (host, port, service name)
   - Create database user and password
   - Configure network access rules

2. **Compute Instance**:
   - Ubuntu 22.04 LTS instance (VM.Standard.E2.1.Micro or higher)
   - At least 2GB RAM, 50GB storage
   - Security list configured for ports 80, 443, 22

### Environment Variables
Create a `.env` file with the following variables:

```bash
# Database Configuration
DATABASE_URL=oracle+cx_oracle://username:password@host:port/service_name

# Authentication
SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS Configuration
CORS_ORIGINS=https://yourdomain.com,http://localhost:3000

# Oracle Database Credentials (for Docker)
ORACLE_PASSWORD=your_oracle_password
APP_USER=your_app_username
APP_USER_PASSWORD=your_app_password

# Frontend Configuration
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```

## Deployment Methods

### Method 1: Docker Deployment (Recommended)

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd cognihire-ui
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Deploy with Docker**:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh --docker
   ```

### Method 2: Traditional Deployment

1. **Clone and setup**:
   ```bash
   git clone <your-repo-url>
   cd cognihire-ui
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Deploy traditionally**:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh --traditional
   ```

## Database Setup

### Oracle Autonomous Database Configuration

1. **Create Database User**:
   ```sql
   CREATE USER cognihire IDENTIFIED BY your_password;
   GRANT CONNECT, RESOURCE TO cognihire;
   GRANT CREATE TABLE, CREATE VIEW TO cognihire;
   ALTER USER cognihire QUOTA UNLIMITED ON USERS;
   ```

2. **Update Connection String**:
   - Format: `oracle+cx_oracle://username:password@host:port/service_name`
   - Example: `oracle+cx_oracle://cognihire:password123@adb.us-ashburn-1.oraclecloud.com:1521/dbname_high.adb.oraclecloud.com`

## Post-Deployment Configuration

### SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install snapd
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Configure auto-renewal
sudo certbot renew --dry-run
```

### Firewall Configuration

```bash
# Allow necessary ports
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw --force enable
```

### Monitoring and Logs

```bash
# Check application status
pm2 status

# View application logs
pm2 logs

# Check Nginx status
sudo systemctl status nginx

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**:
   - Verify DATABASE_URL format
   - Check Oracle Autonomous Database network access
   - Ensure database user has proper permissions

2. **Application Won't Start**:
   - Check environment variables
   - Verify all dependencies are installed
   - Check application logs: `pm2 logs`

3. **Nginx Configuration Issues**:
   - Test configuration: `sudo nginx -t`
   - Check syntax errors in nginx config
   - Verify upstream servers are running

### Health Checks

```bash
# Backend health check
curl http://localhost:8000/docs

# Frontend health check
curl http://localhost:3000

# Database connectivity test
python3 -c "import cx_Oracle; print('Oracle client installed')"
```

## Scaling and Performance

### Database Optimization
- Use connection pooling
- Configure appropriate session limits
- Monitor query performance

### Application Scaling
- Use PM2 clustering for multi-core utilization
- Implement Redis for session storage (if needed)
- Configure load balancer for multiple instances

## Backup and Recovery

### Database Backup
```bash
# Oracle Autonomous Database automatic backups
# Configure backup retention in Oracle Cloud Console
```

### Application Backup
```bash
# Backup application files
tar -czf backup-$(date +%Y%m%d).tar.gz /opt/cognihire

# Backup environment configuration
cp .env .env.backup
```

## Security Best Practices

1. **Environment Variables**:
   - Never commit secrets to version control
   - Use strong, unique passwords
   - Rotate secrets regularly

2. **Network Security**:
   - Configure security lists properly
   - Use HTTPS in production
   - Implement rate limiting

3. **Application Security**:
   - Keep dependencies updated
   - Use secure headers
   - Implement proper authentication

## Support

For issues or questions:
- Check application logs
- Verify configuration files
- Test database connectivity
- Review Oracle Cloud documentation

---

**Deployment completed!** Your CogniHire application should now be accessible at your configured domain.