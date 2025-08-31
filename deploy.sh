#!/bin/bash

# 🚀 CogniHire Production Deployment Script for Oracle Free Tier
# This script sets up Next.js frontend + FastAPI backend on Ubuntu VM

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="cognihire"
APP_DIR="/home/ubuntu/cognihire"
FRONTEND_PORT=3000
BACKEND_PORT=8000
DOMAIN=""  # Leave empty for IP-based deployment

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root"
        exit 1
    fi
}

# Update system and install dependencies
install_system_dependencies() {
    print_step "Installing system dependencies..."

    # Update system
    sudo apt update && sudo apt upgrade -y

    # Install Python and pip
    sudo apt install -y python3 python3-venv python3-pip

    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs build-essential

    # Install Nginx
    sudo apt install -y nginx

    # Install Git and other tools
    sudo apt install -y git curl wget unzip

    print_status "System dependencies installed"
}

# Set up application directory
setup_app_directory() {
    print_step "Setting up application directory..."

    # Create app directory
    sudo mkdir -p $APP_DIR
    sudo chown ubuntu:ubuntu $APP_DIR

    # Copy project files (assuming they're already uploaded)
    if [[ ! -f "$APP_DIR/package.json" ]]; then
        print_error "Project files not found in $APP_DIR"
        print_status "Please upload your project files to $APP_DIR first"
        exit 1
    fi

    print_status "Application directory ready"
}

# Set up backend (FastAPI)
setup_backend() {
    print_step "Setting up FastAPI backend..."

    cd $APP_DIR/backend

    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate

    # Install Python dependencies
    pip install --upgrade pip
    pip install -r requirements.txt

    # Create .env file for backend
    cat > .env << EOF
DATABASE_URL=sqlite:///./prod.db
SECRET_KEY=$(openssl rand -hex 32)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
EOF

    print_status "Backend setup completed"
}

# Set up frontend (Next.js)
setup_frontend() {
    print_step "Setting up Next.js frontend..."

    cd $APP_DIR

    # Install Node.js dependencies
    npm install

    # Create production environment file
    cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_SECRET=$(openssl rand -hex 32)
NEXTAUTH_URL=http://localhost:3000
EOF

    # Build the application
    npm run build

    print_status "Frontend setup completed"
}

# Create systemd services
create_systemd_services() {
    print_step "Creating systemd services..."

    # Backend service
    sudo tee /etc/systemd/system/cognihire-backend.service << EOF
[Unit]
Description=CogniHire FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=$APP_DIR/backend
Environment=PATH=$APP_DIR/backend/venv/bin
ExecStart=$APP_DIR/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port $BACKEND_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    # Frontend service
    sudo tee /etc/systemd/system/cognihire-frontend.service << EOF
[Unit]
Description=CogniHire Next.js Frontend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=PORT=$FRONTEND_PORT
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable services
    sudo systemctl daemon-reload
    sudo systemctl enable cognihire-backend
    sudo systemctl enable cognihire-frontend

    print_status "Systemd services created and enabled"
}

# Configure Nginx
configure_nginx() {
    print_step "Configuring Nginx reverse proxy..."

    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/cognihire << EOF
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Frontend - serve Next.js app
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Backend API - proxy to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # API-specific settings
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Static files caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/cognihire /etc/nginx/sites-enabled/

    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default

    # Test configuration
    sudo nginx -t

    print_status "Nginx configuration completed"
}

# Initialize database
initialize_database() {
    print_step "Initializing database..."

    cd $APP_DIR/backend

    # Activate virtual environment
    source venv/bin/activate

    # Run database migrations (if any)
    # python manage.py migrate  # Uncomment if you have migrations

    # Seed initial data
    python -c "
import sqlite3
import os
from datetime import datetime

# Create database
db_path = 'prod.db'
if os.path.exists(db_path):
    os.remove(db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create tables (simplified schema)
cursor.execute('''
CREATE TABLE tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
''')

cursor.execute('''
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
)
''')

# Insert default tenant
cursor.execute(\"\"\"
INSERT INTO tenants (id, name, subdomain)
VALUES ('default-tenant', 'Default Tenant', 'default')
\"\"\")

# Insert default admin user (password: admin123)
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
admin_password = pwd_context.hash('admin123')

cursor.execute(\"\"\"
INSERT INTO users (id, tenant_id, username, email, password_hash, role)
VALUES ('admin-user', 'default-tenant', 'admin', 'admin@cognihire.com', ?, 'ADMIN')
\"\"\", (admin_password,))

conn.commit()
conn.close()

print('Database initialized successfully')
print('Default admin credentials:')
print('Username: admin')
print('Password: admin123')
"

    print_status "Database initialized"
}

# Start services
start_services() {
    print_step "Starting services..."

    # Start backend
    sudo systemctl start cognihire-backend

    # Wait a moment
    sleep 5

    # Start frontend
    sudo systemctl start cognihire-frontend

    # Start Nginx
    sudo systemctl restart nginx

    print_status "Services started"
}

# Health check
health_check() {
    print_step "Performing health checks..."

    # Wait for services to start
    sleep 10

    # Check backend
    if curl -f http://localhost:$BACKEND_PORT/docs > /dev/null 2>&1; then
        print_status "✅ Backend is healthy"
    else
        print_warning "⚠️  Backend health check failed - may still be starting"
    fi

    # Check frontend
    if curl -f http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        print_status "✅ Frontend is healthy"
    else
        print_warning "⚠️  Frontend health check failed - may still be starting"
    fi

    # Check Nginx
    if sudo systemctl is-active --quiet nginx; then
        print_status "✅ Nginx is running"
    else
        print_error "❌ Nginx is not running"
    fi
}

# Configure firewall
configure_firewall() {
    print_step "Configuring firewall..."

    sudo ufw allow OpenSSH
    sudo ufw allow 'Nginx Full'
    sudo ufw --force enable

    print_status "Firewall configured"
}

# Main deployment function
main() {
    print_status "🚀 Starting CogniHire production deployment..."

    check_root
    install_system_dependencies
    setup_app_directory
    setup_backend
    setup_frontend
    create_systemd_services
    configure_nginx
    initialize_database
    start_services
    health_check
    configure_firewall

    # Get public IP
    PUBLIC_IP=$(curl -s ifconfig.me)

    print_status "🎉 Deployment completed successfully!"
    echo ""
    print_status "Application URLs:"
    echo "  🌐 Frontend: http://$PUBLIC_IP"
    echo "  🔌 Backend API: http://$PUBLIC_IP/api/"
    echo "  📚 API Docs: http://$PUBLIC_IP/api/docs"
    echo ""
    print_status "Default Admin Credentials:"
    echo "  👤 Username: admin"
    echo "  🔑 Password: admin123"
    echo ""
    print_status "Useful Commands:"
    echo "  📊 Check status: sudo systemctl status cognihire-*"
    echo "  📋 View logs: sudo journalctl -u cognihire-backend -f"
    echo "  🔄 Restart services: sudo systemctl restart cognihire-*"
    echo "  🛑 Stop services: sudo systemctl stop cognihire-*"
    echo ""
    print_warning "Remember to:"
    echo "  1. Update your domain name in Nginx config if using one"
    echo "  2. Set up SSL certificate with Let's Encrypt for HTTPS"
    echo "  3. Configure proper database backups"
    echo "  4. Set up monitoring and logging"
}

# Run main function
main "$@"