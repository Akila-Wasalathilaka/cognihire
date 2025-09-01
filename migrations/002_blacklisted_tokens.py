"""Add blacklisted tokens table

Revision ID: 002
Revises: 001
Create Date: 2025-09-01 02:35:00.000000

"""

# revision identifiers
revision = '002'
down_revision = '001'

def upgrade():
    """Create blacklisted_tokens table"""
    
    # SQLite version
    sqlite_sql = """
    CREATE TABLE IF NOT EXISTS blacklisted_tokens (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        token_jti TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        blacklisted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_jti ON blacklisted_tokens(token_jti);
    CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires ON blacklisted_tokens(expires_at);
    """
    
    # PostgreSQL version (for future use)
    postgres_sql = """
    CREATE TABLE IF NOT EXISTS blacklisted_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_jti VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID NOT NULL,
        blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_jti ON blacklisted_tokens(token_jti);
    CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires ON blacklisted_tokens(expires_at);
    """
    
    return sqlite_sql, postgres_sql

def downgrade():
    """Drop blacklisted_tokens table"""
    return "DROP TABLE IF EXISTS blacklisted_tokens;"

if __name__ == "__main__":
    print("Migration 002: Add blacklisted tokens table")
    sqlite_sql, postgres_sql = upgrade()
    print("SQLite SQL:")
    print(sqlite_sql)
    print("\nPostgreSQL SQL:")
    print(postgres_sql)