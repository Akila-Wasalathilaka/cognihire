#!/usr/bin/env python3
"""
Test script to verify the CogniHire API is working correctly
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_login():
    """Test login functionality"""
    print("🔐 Testing login...")
    
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Login successful!")
        print(f"   Access token: {data.get('access_token', 'N/A')[:50]}...")
        return data.get('access_token')
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_analytics(token):
    """Test analytics endpoint"""
    print("\n📊 Testing analytics...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(f"{BASE_URL}/admin/analytics/overview", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Analytics successful!")
        print(f"   Total candidates: {data.get('total_candidates')}")
        print(f"   Active candidates: {data.get('active_candidates')}")
        print(f"   Total assessments: {data.get('total_assessments')}")
        print(f"   Completed assessments: {data.get('completed_assessments')}")
        print(f"   Total job roles: {data.get('total_job_roles')}")
        return data
    else:
        print(f"❌ Analytics failed: {response.status_code} - {response.text}")
        return None

def test_candidates(token):
    """Test candidates endpoint"""
    print("\n👥 Testing candidates endpoint...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(f"{BASE_URL}/admin/candidates", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Candidates endpoint successful!")
        print(f"   Found {len(data)} candidates")
        for candidate in data[:3]:  # Show first 3
            print(f"   - {candidate.get('username')} ({candidate.get('full_name')})")
        return data
    else:
        print(f"❌ Candidates failed: {response.status_code} - {response.text}")
        return None

def test_job_roles(token):
    """Test job roles endpoint"""
    print("\n💼 Testing job roles endpoint...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(f"{BASE_URL}/job-roles", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Job roles endpoint successful!")
        print(f"   Found {len(data)} job roles")
        for role in data:
            print(f"   - {role.get('title')}")
        return data
    else:
        print(f"❌ Job roles failed: {response.status_code} - {response.text}")
        return None

def main():
    print("🚀 Starting CogniHire API Tests")
    print("=" * 50)
    
    # Test login
    token = test_login()
    if not token:
        print("\n❌ Cannot continue without valid token")
        return
    
    # Test all endpoints
    analytics_data = test_analytics(token)
    candidates_data = test_candidates(token)
    job_roles_data = test_job_roles(token)
    
    # Summary
    print("\n" + "=" * 50)
    print("🎯 Test Summary:")
    print(f"✅ Login: {'Success' if token else 'Failed'}")
    print(f"✅ Analytics: {'Success' if analytics_data else 'Failed'}")
    print(f"✅ Candidates: {'Success' if candidates_data else 'Failed'}")
    print(f"✅ Job Roles: {'Success' if job_roles_data else 'Failed'}")
    
    if all([token, analytics_data, candidates_data, job_roles_data]):
        print("\n🎉 All tests passed! The API is working correctly.")
    else:
        print("\n⚠️ Some tests failed. Check the output above.")

if __name__ == "__main__":
    main()
