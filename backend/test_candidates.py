#!/usr/bin/env python3
"""
Test script to check candidates filtering
"""

import sqlite3
import os

def test_candidates():
    """Test candidates query"""
    
    # Path to the database
    db_path = "/home/ubuntu/cognihire/backend/prod.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check all users
        cursor.execute("SELECT id, username, role FROM users")
        all_users = cursor.fetchall()
        print("All users:")
        for user in all_users:
            print(f"  {user[0][:8]}... | {user[1]} | {user[2]}")
        
        # Check candidates (non-admin)
        cursor.execute("SELECT id, username, role FROM users WHERE LOWER(role) NOT IN ('admin')")
        candidates = cursor.fetchall()
        print(f"\nCandidates (excluding admin): {len(candidates)} found")
        for candidate in candidates:
            print(f"  {candidate[0][:8]}... | {candidate[1]} | {candidate[2]}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_candidates()
