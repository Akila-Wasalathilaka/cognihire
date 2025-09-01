#!/usr/bin/env python3
"""Quick test of analytics endpoint"""

import sqlite3

def test_analytics():
    print("=== TESTING ANALYTICS LOCALLY ===")
    
    # Test with server database
    conn = sqlite3.connect('prod-server.db')
    c = conn.cursor()
    
    # Check candidates (should be 4 based on earlier output)
    c.execute("SELECT COUNT(*) FROM users WHERE LOWER(role) = 'candidate'")
    candidates = c.fetchone()[0]
    
    # Check active candidates
    c.execute("SELECT COUNT(*) FROM users WHERE LOWER(role) = 'candidate' AND is_active = 1")
    active_candidates = c.fetchone()[0]
    
    # Check job roles (should be 5 based on earlier output)
    c.execute("SELECT COUNT(*) FROM job_roles")
    job_roles = c.fetchone()[0]
    
    # Check assessments
    c.execute("SELECT COUNT(*) FROM assessments")
    assessments = c.fetchone()[0]
    
    conn.close()
    
    print(f"Expected Analytics Response:")
    print(f"{{")
    print(f"  'total_candidates': {candidates},")
    print(f"  'active_candidates': {active_candidates},")
    print(f"  'total_assessments': {assessments},")
    print(f"  'completed_assessments': 0,")
    print(f"  'total_job_roles': {job_roles}")
    print(f"}}")
    
    return {
        'total_candidates': candidates,
        'active_candidates': active_candidates,
        'total_assessments': assessments,
        'completed_assessments': 0,
        'total_job_roles': job_roles
    }

if __name__ == "__main__":
    test_analytics()
