#!/usr/bin/env python3
"""
Complete database initialization script for CogniHire
Creates all tables and seeds with test data for both SQLite and Oracle
"""

import os
import sys
from datetime import datetime, timedelta
from passlib.context import CryptContext
import uuid

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base, get_db, DATABASE_URL
from models import (
    Tenant, User, Game, JobRole, CandidateProfile, 
    Assessment, AssessmentItem, Report, BlacklistedToken, AuditLog
)
from sqlalchemy.orm import Session

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def init_database():
    """Initialize database with tables and test data"""
    
    print(f"Initializing database: {DATABASE_URL}")
    
    try:
        # Create all tables
        print("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
        
        # Create a database session
        db = Session(bind=engine)
        
        try:
            # Check if data already exists
            existing_tenants = db.query(Tenant).count()
            if existing_tenants > 0:
                print("⚠️ Database already contains data. Skipping seed data creation.")
                return
            
            print("Seeding database with test data...")
            
            # 1. Create default tenant
            default_tenant = Tenant(
                id=str(uuid.uuid4()),
                name="CogniHire Demo",
                subdomain="demo"
            )
            db.add(default_tenant)
            db.flush()  # Get the ID
            
            # 2. Create job roles
            job_roles = [
                {
                    "title": "Software Developer",
                    "description": "Full-stack software development role requiring problem-solving and analytical skills",
                    "traits_json": {
                        "cognitive_traits": ["logical_reasoning", "working_memory", "attention"],
                        "difficulty": "medium"
                    }
                },
                {
                    "title": "Data Analyst",
                    "description": "Analyze data patterns and create insights for business decisions",
                    "traits_json": {
                        "cognitive_traits": ["analytical_thinking", "attention_to_detail", "pattern_recognition"],
                        "difficulty": "medium"
                    }
                },
                {
                    "title": "Project Manager",
                    "description": "Lead and coordinate project teams to deliver successful outcomes",
                    "traits_json": {
                        "cognitive_traits": ["working_memory", "multitasking", "decision_making"],
                        "difficulty": "high"
                    }
                },
                {
                    "title": "UI/UX Designer",
                    "description": "Design user interfaces and experiences for digital products",
                    "traits_json": {
                        "cognitive_traits": ["visual_processing", "creativity", "attention_to_detail"],
                        "difficulty": "medium"
                    }
                }
            ]
            
            created_job_roles = []
            for role_data in job_roles:
                job_role = JobRole(
                    id=str(uuid.uuid4()),
                    tenant_id=default_tenant.id,
                    title=role_data["title"],
                    description=role_data["description"],
                    traits_json=role_data["traits_json"],
                    config_json={"assessment_duration": 30, "max_attempts": 3}
                )
                db.add(job_role)
                created_job_roles.append(job_role)
            
            db.flush()  # Get job role IDs
            
            # 3. Create admin user
            admin_user = User(
                id=str(uuid.uuid4()),
                tenant_id=default_tenant.id,
                email="admin@cognihire.com",
                username="admin",
                full_name="System Administrator",
                password_hash=hash_password("admin123"),
                role="ADMIN",
                is_active=True,
                mfa_enabled=False,
                created_at=datetime.utcnow()
            )
            db.add(admin_user)
            
            # 4. Create candidate users
            candidates_data = [
                {
                    "username": "john_doe",
                    "email": "john.doe@example.com",
                    "full_name": "John Doe",
                    "password": "password123",
                    "job_role": created_job_roles[0]  # Software Developer
                },
                {
                    "username": "jane_smith",
                    "email": "jane.smith@example.com",
                    "full_name": "Jane Smith",
                    "password": "password123",
                    "job_role": created_job_roles[1]  # Data Analyst
                },
                {
                    "username": "mike_johnson",
                    "email": "mike.johnson@example.com",
                    "full_name": "Mike Johnson",
                    "password": "password123",
                    "job_role": created_job_roles[2]  # Project Manager
                },
                {
                    "username": "sarah_wilson",
                    "email": "sarah.wilson@example.com",
                    "full_name": "Sarah Wilson",
                    "password": "password123",
                    "job_role": created_job_roles[3]  # UI/UX Designer
                }
            ]
            
            created_candidates = []
            for candidate_data in candidates_data:
                candidate = User(
                    id=str(uuid.uuid4()),
                    tenant_id=default_tenant.id,
                    email=candidate_data["email"],
                    username=candidate_data["username"],
                    full_name=candidate_data["full_name"],
                    password_hash=hash_password(candidate_data["password"]),
                    role="CANDIDATE",
                    job_role_id=candidate_data["job_role"].id,
                    is_active=True,
                    mfa_enabled=False,
                    created_at=datetime.utcnow()
                )
                db.add(candidate)
                created_candidates.append(candidate)
            
            db.flush()  # Get candidate IDs
            
            # 5. Create games
            games = [
                {
                    "code": "n_back",
                    "title": "N-Back Working Memory",
                    "description": "Test working memory and concentration",
                    "base_config": {
                        "n_level": 2,
                        "trials": 20,
                        "stimulus_duration": 500,
                        "inter_stimulus_interval": 2500
                    }
                },
                {
                    "code": "stroop_test",
                    "title": "Stroop Color-Word Test",
                    "description": "Test cognitive flexibility and attention",
                    "base_config": {
                        "trials": 50,
                        "congruent_ratio": 0.5,
                        "response_timeout": 3000
                    }
                },
                {
                    "code": "reaction_time",
                    "title": "Simple Reaction Time",
                    "description": "Test processing speed and attention",
                    "base_config": {
                        "trials": 30,
                        "min_delay": 1000,
                        "max_delay": 4000,
                        "stimulus_duration": 1000
                    }
                }
            ]
            
            created_games = []
            for game_data in games:
                game = Game(
                    id=str(uuid.uuid4()),
                    code=game_data["code"],
                    title=game_data["title"],
                    description=game_data["description"],
                    base_config=game_data["base_config"]
                )
                db.add(game)
                created_games.append(game)
            
            db.flush()  # Get game IDs
            
            # 6. Create sample assessments
            for i, candidate in enumerate(created_candidates[:2]):  # Create assessments for first 2 candidates
                assessment = Assessment(
                    id=str(uuid.uuid4()),
                    tenant_id=default_tenant.id,
                    candidate_id=candidate.id,
                    job_role_id=candidate.job_role_id,
                    status="COMPLETED" if i == 0 else "IN_PROGRESS",
                    started_at=datetime.utcnow() - timedelta(hours=2),
                    completed_at=datetime.utcnow() - timedelta(hours=1) if i == 0 else None,
                    total_score=85.5 if i == 0 else None,
                    integrity_flags={"violations": []} if i == 0 else None
                )
                db.add(assessment)
                db.flush()  # Get assessment ID
                
                # Create assessment items (games within the assessment)
                for j, game in enumerate(created_games):
                    item = AssessmentItem(
                        id=str(uuid.uuid4()),
                        assessment_id=assessment.id,
                        game_id=game.id,
                        order_index=j + 1,
                        timer_seconds=300,  # 5 minutes
                        server_started_at=datetime.utcnow() - timedelta(hours=2),
                        server_deadline_at=datetime.utcnow() - timedelta(hours=1, minutes=55),
                        status="SUBMITTED" if i == 0 else "PENDING",
                        score=80 + (j * 5) if i == 0 else None,
                        metrics_json={
                            "accuracy": 0.85 + (j * 0.05),
                            "avg_response_time": 1200 - (j * 100),
                            "consistency": 0.9
                        } if i == 0 else None,
                        config_snapshot=game.base_config
                    )
                    db.add(item)
            
            # Commit all changes
            db.commit()
            
            print("✅ Database initialized successfully!")
            print("\n📊 Created test data:")
            print(f"  - 1 Tenant: {default_tenant.name}")
            print(f"  - 4 Job Roles: {', '.join([jr.title for jr in created_job_roles])}")
            print(f"  - 1 Admin User: admin/admin123")
            print(f"  - 4 Candidate Users:")
            for candidate_data in candidates_data:
                print(f"    • {candidate_data['username']}/password123 ({candidate_data['full_name']})")
            print(f"  - 3 Games: {', '.join([g.title for g in created_games])}")
            print(f"  - 2 Sample Assessments")
            print("\n🎯 Ready to test!")
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error seeding database: {e}")
            raise
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        raise

if __name__ == "__main__":
    init_database()
