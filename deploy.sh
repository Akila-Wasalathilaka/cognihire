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

#!/bin/bash

# CogniHire Production Deployment Script for Oracle Cloud
# This script handles deployment to Oracle Cloud with Oracle Autonomous Database

set -e

echo "🚀 Starting CogniHire Production Deployment on Oracle Cloud"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Check if required environment variables are set
check_env_vars() {
    print_status "Checking environment variables..."

    required_vars=("DATABASE_URL" "SECRET_KEY" "CORS_ORIGINS" "ORACLE_PASSWORD" "APP_USER" "APP_USER_PASSWORD")

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            print_error "Required environment variable $var is not set"
            exit 1
        fi
    done

    print_status "All required environment variables are set"
}

# Install system dependencies
install_dependencies() {
    print_status "Installing system dependencies..."

    # Update system
    sudo apt update && sudo apt upgrade -y

    # Install Node.js 18 (LTS)
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs

    # Install Docker and Docker Compose
    sudo apt install -y docker.io docker-compose
    sudo systemctl start docker
    sudo systemctl enable docker

    # Add user to docker group
    sudo usermod -aG docker $USER

    print_status "System dependencies installed"
}

# Build and deploy with Docker
deploy_docker() {
    print_status "Deploying with Docker..."

    # Build images
    docker build -f Dockerfile.backend -t cognihire-backend:latest .
    docker build -f Dockerfile.frontend -t cognihire-frontend:latest .

    # Start services
    docker-compose up -d

    print_status "Docker deployment completed"
}

# Alternative: Deploy without Docker (traditional method)
deploy_traditional() {
    print_status "Deploying with traditional method..."

    # Install Python and pip
    sudo apt install -y python3 python3-pip python3-venv

    # Install Oracle Instant Client
    sudo apt install -y libaio1 wget unzip
    wget https://download.oracle.com/otn_software/linux/instantclient/1923000/instantclient-basic-linux.x64-19.23.0.0.0dbru.zip -O /tmp/instantclient-basic.zip
    wget https://download.oracle.com/otn_software/linux/instantclient/1923000/instantclient-sdk-linux.x64-19.23.0.0.0dbru.zip -O /tmp/instantclient-sdk.zip
    sudo unzip /tmp/instantclient-basic.zip -d /opt/oracle/
    sudo unzip /tmp/instantclient-sdk.zip -d /opt/oracle/
    sudo sh -c "echo /opt/oracle/instantclient_19_23 > /etc/ld-musl-x86_64.path"

    # Set Oracle environment variables
    export LD_LIBRARY_PATH=/opt/oracle/instantclient_19_23:$LD_LIBRARY_PATH
    export ORACLE_HOME=/opt/oracle/instantclient_19_23

    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate

    # Install Python dependencies
    pip install -r backend/requirements.txt

    # Install PM2 for process management
    sudo npm install -g pm2

    # Build frontend
    npm install
    npm run build

    # Start backend with PM2
    pm2 start "uvicorn backend.main:app --host 0.0.0.0 --port 8000" --name "cognihire-backend"
    pm2 start npm --name "cognihire-frontend" -- start

    pm2 startup
    pm2 save

    print_status "Traditional deployment completed"
}

# Configure Nginx reverse proxy
configure_nginx() {
    print_status "Configuring Nginx..."

    sudo apt install -y nginx

    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/cognihire << EOF
server {
    listen 80;
    server_name _;

    # Frontend
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

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/;
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

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/cognihire /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    sudo systemctl enable nginx

    print_status "Nginx configured"
}

# Health check
health_check() {
    print_status "Performing health checks..."

    sleep 10

    # Check backend
    if curl -f http://localhost:8000/docs > /dev/null 2>&1; then
        print_status "Backend is healthy"
    else
        print_warning "Backend health check failed - may still be starting"
    fi

    # Check frontend
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        print_status "Frontend is healthy"
    else
        print_warning "Frontend health check failed - may still be starting"
    fi
}

# Main deployment function
main() {
    print_status "Starting deployment process..."

    check_env_vars

    if [[ "$1" == "--docker" ]]; then
        install_dependencies
        deploy_docker
    elif [[ "$1" == "--traditional" ]]; then
        install_dependencies
        deploy_traditional
    else
        print_warning "No deployment method specified."
        print_status "Usage:"
        echo "  $0 --docker      # Deploy using Docker (recommended)"
        echo "  $0 --traditional # Deploy using system packages"
        exit 1
    fi

    configure_nginx
    health_check

    print_status "🎉 Deployment completed successfully!"
    print_status "Application URLs:"
    echo "  Frontend: http://$(curl -s ifconfig.me)"
    echo "  Backend API: http://$(curl -s ifconfig.me)/api/"
    echo "  API Docs: http://$(curl -s ifconfig.me)/api/docs"
    echo ""
    print_status "Useful commands:"
    echo "  Docker: docker-compose logs -f"
    echo "  PM2: pm2 status"
    echo "  Nginx: sudo systemctl status nginx"
}

# Run main function with all arguments
main "$@"

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