#!/bin/bash

# Database initialization script for CogniHire
# This script sets up the SQLite database with initial schema and seed data

set -e

echo "Initializing CogniHire database..."

# Check if we're in the backend directory
if [[ ! -f "requirements.txt" ]]; then
    echo "Error: Please run this script from the backend directory"
    exit 1
fi

# Activate virtual environment if it exists
if [[ -d "venv" ]]; then
    source venv/bin/activate
fi

# Run database initialization
python3 -c "
import sqlite3
import os
from datetime import datetime

# Create database
db_path = 'prod.db'
if os.path.exists(db_path):
    print(f'Removing existing database: {db_path}')
    os.remove(db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('Creating database tables...')

# Create tenants table
cursor.execute('''
CREATE TABLE tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
''')

# Create users table
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

# Create job_roles table
cursor.execute('''
CREATE TABLE job_roles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    requirements TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
)
''')

# Create candidates table
cursor.execute('''
CREATE TABLE candidates (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    resume_url TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
)
''')

# Create games table
cursor.execute('''
CREATE TABLE games (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    title TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    config_json TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
)
''')

# Create assessments table
cursor.execute('''
CREATE TABLE assessments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    candidate_id TEXT NOT NULL,
    job_role_id TEXT NOT NULL,
    status TEXT DEFAULT 'NOT_STARTED',
    started_at TEXT,
    completed_at TEXT,
    total_score REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants (id),
    FOREIGN KEY (candidate_id) REFERENCES candidates (id),
    FOREIGN KEY (job_role_id) REFERENCES job_roles (id)
)
''')

# Create assessment_items table
cursor.execute('''
CREATE TABLE assessment_items (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    timer_seconds INTEGER DEFAULT 300,
    server_started_at TEXT,
    server_deadline_at TEXT,
    status TEXT DEFAULT 'PENDING',
    score REAL,
    metrics_json TEXT,
    config_snapshot TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments (id),
    FOREIGN KEY (game_id) REFERENCES games (id)
)
''')

# Create telemetry table
cursor.execute('''
CREATE TABLE telemetry (
    id TEXT PRIMARY KEY,
    assessment_item_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_item_id) REFERENCES assessment_items (id)
)
''')

print('Inserting seed data...')

# Insert default tenant
cursor.execute('''
INSERT INTO tenants (id, name, subdomain)
VALUES (?, ?, ?)
''', ('default-tenant', 'Default Tenant', 'default'))

# Insert default admin user (password: admin123)
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
    admin_password = pwd_context.hash('admin123')
except ImportError:
    # Fallback if passlib is not available
    import hashlib
    admin_password = hashlib.sha256('admin123'.encode()).hexdigest()

cursor.execute('''
INSERT INTO users (id, tenant_id, username, email, password_hash, role)
VALUES (?, ?, ?, ?, ?, ?)
''', ('admin-user', 'default-tenant', 'admin', 'admin@cognihire.com', admin_password, 'ADMIN'))

# Insert sample job roles
cursor.execute('''
INSERT INTO job_roles (id, tenant_id, title, description)
VALUES
(?, ?, ?, ?),
(?, ?, ?, ?),
(?, ?, ?, ?)
''', (
    'jr-1', 'default-tenant', 'Software Engineer', 'Full-stack software development position',
    'jr-2', 'default-tenant', 'Data Analyst', 'Data analysis and visualization role',
    'jr-3', 'default-tenant', 'Product Manager', 'Product management and strategy position'
))

# Insert sample games
cursor.execute('''
INSERT INTO games (id, tenant_id, title, code, description, config_json)
VALUES
(?, ?, ?, ?, ?, ?),
(?, ?, ?, ?, ?, ?),
(?, ?, ?, ?, ?, ?)
''', (
    'game-1', 'default-tenant', 'N-Back Memory Test', 'NBACK',
    'Test working memory and attention', '{"n": 2, "trials": 20, "stimulus_duration": 500}',
    'game-2', 'default-tenant', 'Stroop Color Test', 'STROOP',
    'Test cognitive flexibility and processing speed', '{"trials": 30, "colors": ["red", "blue", "green", "yellow"]}',
    'game-3', 'default-tenant', 'Reaction Time Test', 'REACTION_TIME',
    'Test motor response speed and alertness', '{"trials": 25, "max_delay": 3000}'
))

# Insert sample candidates
cursor.execute('''
INSERT INTO candidates (id, tenant_id, first_name, last_name, email)
VALUES
(?, ?, ?, ?, ?),
(?, ?, ?, ?, ?)
''', (
    'cand-1', 'default-tenant', 'John', 'Doe', 'john.doe@example.com',
    'cand-2', 'default-tenant', 'Jane', 'Smith', 'jane.smith@example.com'
))

conn.commit()
conn.close()

print('Database initialized successfully!')
print('')
print('Default admin credentials:')
print('Username: admin')
print('Password: admin123')
print('')
print('Sample data created:')
print('- 1 tenant (default-tenant)')
print('- 1 admin user')
print('- 3 job roles')
print('- 3 games (N-Back, Stroop, Reaction Time)')
print('- 2 sample candidates')
"

echo "Database initialization completed!"