#!/bin/bash
sudo -u postgres psql -c "CREATE USER cognihire WITH PASSWORD 'password123';"
sudo -u postgres psql -c "CREATE DATABASE cognihire OWNER cognihire;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cognihire TO cognihire;"
echo "PostgreSQL setup completed successfully"
