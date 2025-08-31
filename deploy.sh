#!/bin/bash

# CogniHire Deployment Script for Oracle Cloud Ubuntu Instance
# This script sets up the full-stack application with PostgreSQL backend

set -e

echo "🚀 Starting CogniHire deployment on Oracle Cloud..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 (LTS)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Set up PostgreSQL database and user
echo "🗄️ Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE USER cognihire WITH PASSWORD 'password123';"
sudo -u postgres psql -c "CREATE DATABASE cognihire OWNER cognihire;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cognihire TO cognihire;"

# Allow password authentication for local connections
sudo sed -i 's/local   all             postgres                                peer/local   all             postgres                                md5/' /etc/postgresql/14/main/pg_hba.conf
sudo sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' /etc/postgresql/14/main/pg_hba.conf
sudo systemctl restart postgresql

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/cognihire
sudo chown ubuntu:ubuntu /opt/cognihire

# Clone the repository (replace with your actual repo URL)
echo "📥 Cloning repository..."
cd /opt/cognihire
git clone https://github.com/pasindu-2002/CogniHire.UI.git .  # Replace with actual repo

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Set up environment variables
echo "⚙️ Setting up environment variables..."
cat > .env.local << EOF
POSTGRES_USER=cognihire
POSTGRES_PASSWORD=password123
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=cognihire
POSTGRES_POOL_MAX=10
POSTGRES_POOL_MIN=2
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=2000

# JWT Secret (generate a secure one in production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Next.js
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://129.154.244.25  # Replace with your domain/IP

# Application
NODE_ENV=production
EOF

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# Seed database
echo "🌱 Seeding database..."
npm run db:seed

# Build the application
echo "🔨 Building application..."
npm run build

# Start the application with PM2
echo "🚀 Starting application..."
pm2 start npm --name "cognihire" -- start
pm2 startup
pm2 save

# Install and configure Nginx
echo "🌐 Installing and configuring Nginx..."
sudo apt install -y nginx

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/cognihire << EOF
server {
    listen 80;
    server_name 129.154.244.25;  # Replace with your domain/IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site and restart Nginx
sudo ln -s /etc/nginx/sites-available/cognihire /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Set up firewall
echo "🔥 Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "✅ Deployment completed successfully!"
echo "🌐 Your application should be available at: http://129.154.244.25"
echo ""
echo "📊 Useful commands:"
echo "  - Check app status: pm2 status"
echo "  - View logs: pm2 logs cognihire"
echo "  - Restart app: pm2 restart cognihire"
echo "  - Check Nginx: sudo systemctl status nginx"
echo "  - Database access: sudo -u postgres psql -d cognihire"