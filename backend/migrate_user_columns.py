#!/usr/bin/env python3
"""
Migration script to add full_name and job_role_id columns to users table
"""

import sqlite3
import os
import sys

def migrate_database():
    """Add missing columns to users table"""
    
    # Path to the database
    db_path = os.path.join(os.path.dirname(__file__), 'test.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]
        
        print(f"Current columns in users table: {columns}")
        
        # Add full_name column if it doesn't exist
        if 'full_name' not in columns:
            print("Adding full_name column...")
            cursor.execute("ALTER TABLE users ADD COLUMN full_name VARCHAR(200)")
            print("✓ Added full_name column")
        else:
            print("✓ full_name column already exists")
        
        # Add job_role_id column if it doesn't exist
        if 'job_role_id' not in columns:
            print("Adding job_role_id column...")
            cursor.execute("ALTER TABLE users ADD COLUMN job_role_id VARCHAR(36)")
            print("✓ Added job_role_id column")
        else:
            print("✓ job_role_id column already exists")
        
        # Commit changes
        conn.commit()
        print("✓ Database migration completed successfully")
        
        # Verify the changes
        cursor.execute("PRAGMA table_info(users)")
        new_columns = [row[1] for row in cursor.fetchall()]
        print(f"Updated columns in users table: {new_columns}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"Error during migration: {e}")
        return False

if __name__ == "__main__":
    print("Starting database migration...")
    success = migrate_database()
    
    if success:
        print("Migration completed successfully!")
        sys.exit(0)
    else:
        print("Migration failed!")
        sys.exit(1)
