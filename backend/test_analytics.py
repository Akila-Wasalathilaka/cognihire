#!/usr/bin/env python3
"""
Test script to verify analytics queries work correctly
"""

import sqlite3
import os

def test_analytics():
    """Test the analytics queries on the production database"""
    
    # Path to the database
    db_path = '/home/ubuntu/cognihire/backend/prod.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("=== DATABASE ANALYTICS TEST ===\n")
        
        # Test 1: All users
        cursor.execute("SELECT id, username, role FROM users")
        all_users = cursor.fetchall()
        print(f"All users in database: {len(all_users)}")
        for user in all_users:
            print(f"  - {user[1]} ({user[2]})")
        
        # Test 2: Count candidates using the same logic as backend
        cursor.execute("SELECT COUNT(*) FROM users WHERE LOWER(role) IN ('candidate', 'user')")
        candidate_count = cursor.fetchone()[0]
        print(f"\nTotal candidates (role='candidate' or 'user'): {candidate_count}")
        
        # Test 3: Active candidates
        cursor.execute("SELECT COUNT(*) FROM users WHERE LOWER(role) IN ('candidate', 'user') AND is_active = 1")
        active_candidates = cursor.fetchone()[0]
        print(f"Active candidates: {active_candidates}")
        
        # Test 4: All job roles
        cursor.execute("SELECT COUNT(*) FROM job_roles")
        job_roles_count = cursor.fetchone()[0]
        print(f"Total job roles: {job_roles_count}")
        
        # Test 5: All assessments
        cursor.execute("SELECT COUNT(*) FROM assessments")
        assessments_count = cursor.fetchone()[0]
        print(f"Total assessments: {assessments_count}")
        
        # Test 6: Completed assessments
        cursor.execute("SELECT COUNT(*) FROM assessments WHERE status = 'COMPLETED'")
        completed_assessments = cursor.fetchone()[0]
        print(f"Completed assessments: {completed_assessments}")
        
        print(f"\n=== EXPECTED ANALYTICS RESULT ===")
        print(f"{{")
        print(f"  'total_candidates': {candidate_count},")
        print(f"  'active_candidates': {active_candidates},")
        print(f"  'total_assessments': {assessments_count},")
        print(f"  'completed_assessments': {completed_assessments},")
        print(f"  'total_job_roles': {job_roles_count}")
        print(f"}}")
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_analytics()
