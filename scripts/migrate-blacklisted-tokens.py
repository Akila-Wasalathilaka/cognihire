#!/usr/bin/env python3
"""
Run database migration for blacklisted tokens
"""
import sqlite3
import os
from pathlib import Path

def run_migration():
    """Run the blacklisted tokens migration"""
    
    # Get database path
    db_path = Path(__file__).parent / "backend" / "cognihire.db"
    
    # SQL for the migration
    migration_sql = """
    -- Create blacklisted_tokens table
    CREATE TABLE IF NOT EXISTS blacklisted_tokens (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        token_jti TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        blacklisted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    
    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_jti ON blacklisted_tokens(token_jti);
    CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires ON blacklisted_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_user ON blacklisted_tokens(user_id);
    
    -- Create schema_migrations table if it doesn't exist
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Insert migration record
    INSERT OR IGNORE INTO schema_migrations (version, applied_at) 
    VALUES ('002_blacklisted_tokens', CURRENT_TIMESTAMP);
    """
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Execute migration
        cursor.executescript(migration_sql)
        conn.commit()
        
        print("✅ Migration 002_blacklisted_tokens completed successfully!")
        
        # Verify the table was created
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='blacklisted_tokens';")
        if cursor.fetchone():
            print("✅ blacklisted_tokens table created successfully")
        else:
            print("❌ Failed to create blacklisted_tokens table")
            
        # Check indexes
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='blacklisted_tokens';")
        indexes = cursor.fetchall()
        print(f"✅ Created {len(indexes)} indexes for blacklisted_tokens table")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False
        
    return True

if __name__ == "__main__":
    print("Running migration: 002_blacklisted_tokens")
    success = run_migration()
    exit(0 if success else 1)